import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import { Plus, ShoppingCart, Eye, Check, X, Calendar, DollarSign } from 'lucide-react';

// Import types
import type { PurchaseOrder, Supplier, Item, CreatePurchaseOrderInput } from '../../../server/src/schema';

interface PurchaseOrderManagementProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  canApprove: boolean;
}

export function PurchaseOrderManagement({ currentUser, canApprove }: PurchaseOrderManagementProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poNumber, setPONumber] = useState('');

  // Form state
  const [createForm, setCreateForm] = useState<CreatePurchaseOrderInput>({
    supplier_id: 0,
    expected_delivery_date: null,
    notes: null,
    items: []
  });

  const [selectedItems, setSelectedItems] = useState<Array<{
    item_id: number;
    quantity: number;
    unit_price: number;
  }>>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [poResult, suppliersResult, itemsResult] = await Promise.all([
        trpc.getPurchaseOrders.query(),
        trpc.getSuppliers.query(),
        trpc.getItems.query()
      ]);
      setPurchaseOrders(poResult);
      setSuppliers(suppliersResult);
      setItems(itemsResult);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generatePONumber = useCallback(async () => {
    try {
      const result = await trpc.generatePONumber.query();
      setPONumber(result);
    } catch (error) {
      console.error('Failed to generate PO number:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isCreateDialogOpen) {
      generatePONumber();
    }
  }, [isCreateDialogOpen, generatePONumber]);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Please add at least one item to the purchase order');
      return;
    }

    setIsLoading(true);
    try {
      const newPO = await trpc.createPurchaseOrder.mutate({
        ...createForm,
        items: selectedItems,
        createdBy: currentUser.id
      });
      setPurchaseOrders((prev: PurchaseOrder[]) => [newPO, ...prev]);
      
      // Reset form
      setCreateForm({
        supplier_id: 0,
        expected_delivery_date: null,
        notes: null,
        items: []
      });
      setSelectedItems([]);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create purchase order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (poId: number, newStatus: string) => {
    setIsLoading(true);
    try {
      await trpc.updatePurchaseOrderStatus.mutate({
        id: poId,
        status: newStatus as any,
        updatedBy: currentUser.id
      });
      await loadData(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItemToPO = () => {
    setSelectedItems([...selectedItems, {
      item_id: 0,
      quantity: 1,
      unit_price: 0
    }]);
  };

  const removeItemFromPO = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateSelectedItem = (index: number, field: string, value: any) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-update unit price when item is selected
    if (field === 'item_id') {
      const item = items.find(i => i.id === value);
      if (item) {
        updated[index].unit_price = item.unit_cost;
      }
    }
    
    setSelectedItems(updated);
  };

  const getTotalAmount = () => {
    return selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      ORDERED: 'bg-purple-100 text-purple-800',
      RECEIVED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredPOs = statusFilter === 'all' 
    ? purchaseOrders 
    : purchaseOrders.filter(po => po.status === statusFilter);

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Unknown Supplier';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Order Management
          </CardTitle>
          <CardDescription>
            Create, track, and manage purchase orders for inventory replenishment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="ORDERED">Ordered</SelectItem>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Purchase Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleCreatePO}>
                  <DialogHeader>
                    <DialogTitle>Create Purchase Order</DialogTitle>
                    <DialogDescription>
                      PO Number: {poNumber}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    {/* Basic Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="supplier">Supplier *</Label>
                        <Select
                          value={createForm.supplier_id.toString()}
                          onValueChange={(value: string) => 
                            setCreateForm((prev: CreatePurchaseOrderInput) => ({ ...prev, supplier_id: parseInt(value) }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((supplier: Supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="delivery_date">Expected Delivery Date</Label>
                        <Input
                          id="delivery_date"
                          type="date"
                          value={createForm.expected_delivery_date?.toISOString().split('T')[0] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreatePurchaseOrderInput) => ({
                              ...prev,
                              expected_delivery_date: e.target.value ? new Date(e.target.value) : null
                            }))
                          }
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={createForm.notes || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setCreateForm((prev: CreatePurchaseOrderInput) => ({ ...prev, notes: e.target.value || null }))
                        }
                        placeholder="Additional notes or special instructions..."
                      />
                    </div>

                    {/* Items Section */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label>Items</Label>
                        <Button type="button" variant="outline" onClick={addItemToPO}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                      
                      {selectedItems.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          No items added yet. Click "Add Item" to start.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {selectedItems.map((selectedItem, index) => (
                            <div key={index} className="grid grid-cols-5 gap-4 p-4 border rounded">
                              <div>
                                <Label>Item</Label>
                                <Select
                                  value={selectedItem.item_id.toString()}
                                  onValueChange={(value: string) => updateSelectedItem(index, 'item_id', parseInt(value))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select item" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {items.map((item: Item) => (
                                      <SelectItem key={item.id} value={item.id.toString()}>
                                        {item.name} ({item.sku})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Quantity</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={selectedItem.quantity}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateSelectedItem(index, 'quantity', parseInt(e.target.value) || 1)
                                  }
                                />
                              </div>
                              <div>
                                <Label>Unit Price</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={selectedItem.unit_price}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateSelectedItem(index, 'unit_price', parseFloat(e.target.value) || 0)
                                  }
                                />
                              </div>
                              <div>
                                <Label>Total</Label>
                                <Input
                                  value={`$${(selectedItem.quantity * selectedItem.unit_price).toFixed(2)}`}
                                  disabled
                                />
                              </div>
                              <div className="flex items-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeItemFromPO(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <div className="text-right">
                            <strong>Total Amount: ${getTotalAmount().toFixed(2)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading || selectedItems.length === 0}>
                      {isLoading ? 'Creating...' : 'Create Purchase Order'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders ({filteredPOs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPOs.map((po: PurchaseOrder) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono">{po.po_number}</TableCell>
                  <TableCell>{getSupplierName(po.supplier_id)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(po.status)}>
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {po.order_date.toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    {po.expected_delivery_date ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {po.expected_delivery_date.toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {po.total_amount.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPO(po);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canApprove && po.status === 'PENDING' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(po.id, 'APPROVED')}
                          disabled={isLoading}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {po.status === 'APPROVED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(po.id, 'ORDERED')}
                          disabled={isLoading}
                        >
                          Order
                        </Button>
                      )}
                      {po.status === 'ORDERED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(po.id, 'RECEIVED')}
                          disabled={isLoading}
                        >
                          Received
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View PO Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Purchase Order Details</DialogTitle>
            <DialogDescription>
              {selectedPO?.po_number}
            </DialogDescription>
          </DialogHeader>
          {selectedPO && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Supplier</Label>
                  <p className="font-medium">{getSupplierName(selectedPO.supplier_id)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(selectedPO.status)}>
                    {selectedPO.status}
                  </Badge>
                </div>
                <div>
                  <Label>Order Date</Label>
                  <p>{selectedPO.order_date.toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Expected Delivery</Label>
                  <p>
                    {selectedPO.expected_delivery_date
                      ? selectedPO.expected_delivery_date.toLocaleDateString()
                      : 'Not set'
                    }
                  </p>
                </div>
              </div>
              {selectedPO.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm text-muted-foreground">{selectedPO.notes}</p>
                </div>
              )}
              <div>
                <Label>Total Amount</Label>
                <p className="text-2xl font-bold">${selectedPO.total_amount.toFixed(2)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}