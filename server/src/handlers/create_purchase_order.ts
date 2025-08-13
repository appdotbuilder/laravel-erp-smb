import { db } from '../db';
import { purchaseOrdersTable, purchaseOrderItemsTable, suppliersTable, itemsTable } from '../db/schema';
import { type CreatePurchaseOrderInput, type PurchaseOrder } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createPurchaseOrder = async (input: CreatePurchaseOrderInput, createdBy: string): Promise<PurchaseOrder> => {
  try {
    // Verify supplier exists and is active
    const supplier = await db.select()
      .from(suppliersTable)
      .where(and(eq(suppliersTable.id, input.supplier_id), eq(suppliersTable.is_active, true)))
      .limit(1)
      .execute();

    if (supplier.length === 0) {
      throw new Error(`Supplier with ID ${input.supplier_id} not found or inactive`);
    }

    // Verify all items exist and are active
    const itemIds = input.items.map(item => item.item_id);
    const items = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.is_active, true))
      .execute();

    // Validate that all requested items exist and are active
    const activeItemIds = items.map(item => item.id);
    const missingItems = itemIds.filter(id => !activeItemIds.includes(id));
    if (missingItems.length > 0) {
      throw new Error(`Items with IDs ${missingItems.join(', ')} not found or inactive`);
    }

    // Generate PO number
    const currentYear = new Date().getFullYear();
    const poPrefix = `PO-${currentYear}-`;
    
    // Get the highest PO number for the current year
    const existingPOs = await db.select({ po_number: purchaseOrdersTable.po_number })
      .from(purchaseOrdersTable)
      .execute();

    const currentYearPOs = existingPOs
      .filter(po => po.po_number.startsWith(poPrefix))
      .map(po => {
        const numberPart = po.po_number.substring(poPrefix.length);
        return parseInt(numberPart, 10);
      })
      .filter(num => !isNaN(num));

    const nextNumber = currentYearPOs.length > 0 ? Math.max(...currentYearPOs) + 1 : 1;
    const poNumber = `${poPrefix}${nextNumber.toString().padStart(6, '0')}`;

    // Calculate total amount
    const totalAmount = input.items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price);
    }, 0);

    // Create purchase order
    const purchaseOrderResult = await db.insert(purchaseOrdersTable)
      .values({
        po_number: poNumber,
        supplier_id: input.supplier_id,
        status: 'DRAFT',
        expected_delivery_date: input.expected_delivery_date ? input.expected_delivery_date.toISOString().split('T')[0] : null, // Convert Date to string (YYYY-MM-DD)
        total_amount: totalAmount.toString(), // Convert to string for numeric column
        notes: input.notes || null,
        created_by: createdBy,
        approved_by: null
      })
      .returning()
      .execute();

    const purchaseOrder = purchaseOrderResult[0];

    // Create purchase order items
    const purchaseOrderItems = input.items.map(item => ({
      purchase_order_id: purchaseOrder.id,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.unit_price.toString(), // Convert to string for numeric column
      total_price: (item.quantity * item.unit_price).toString(), // Convert to string for numeric column
      received_quantity: 0
    }));

    await db.insert(purchaseOrderItemsTable)
      .values(purchaseOrderItems)
      .execute();

    // Return purchase order with numeric fields converted back to numbers
    return {
      ...purchaseOrder,
      total_amount: parseFloat(purchaseOrder.total_amount),
      expected_delivery_date: purchaseOrder.expected_delivery_date ? new Date(purchaseOrder.expected_delivery_date) : null
    };

  } catch (error) {
    console.error('Purchase order creation failed:', error);
    throw error;
  }
};