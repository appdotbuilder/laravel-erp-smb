import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema,
  createItemInputSchema,
  updateItemInputSchema,
  getLowStockItemsInputSchema,
  createSupplierInputSchema,
  createPurchaseOrderInputSchema,
  updatePurchaseOrderStatusInputSchema,
  createWorkOrderInputSchema,
  updateWorkOrderInputSchema,
  createStockAdjustmentInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createItem } from './handlers/create_item';
import { getItems } from './handlers/get_items';
import { updateItem } from './handlers/update_item';
import { getLowStockItems } from './handlers/get_low_stock_items';
import { createSupplier } from './handlers/create_supplier';
import { getSuppliers } from './handlers/get_suppliers';
import { createPurchaseOrder } from './handlers/create_purchase_order';
import { getPurchaseOrders } from './handlers/get_purchase_orders';
import { getPurchaseOrderById } from './handlers/get_purchase_order_by_id';
import { updatePurchaseOrderStatus } from './handlers/update_purchase_order_status';
import { createWorkOrder } from './handlers/create_work_order';
import { getWorkOrders } from './handlers/get_work_orders';
import { getWorkOrderById } from './handlers/get_work_order_by_id';
import { updateWorkOrder } from './handlers/update_work_order';
import { completeWorkOrder } from './handlers/complete_work_order';
import { createStockAdjustment } from './handlers/create_stock_adjustment';
import { getStockAdjustments } from './handlers/get_stock_adjustments';
import { generatePONumber } from './handlers/generate_po_number';
import { generateWONumber } from './handlers/generate_wo_number';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  // Inventory/Item management
  createItem: publicProcedure
    .input(createItemInputSchema)
    .mutation(({ input }) => createItem(input)),

  getItems: publicProcedure
    .query(() => getItems()),

  updateItem: publicProcedure
    .input(updateItemInputSchema)
    .mutation(({ input }) => updateItem(input)),

  getLowStockItems: publicProcedure
    .input(getLowStockItemsInputSchema)
    .query(({ input }) => getLowStockItems(input)),

  // Supplier management
  createSupplier: publicProcedure
    .input(createSupplierInputSchema)
    .mutation(({ input }) => createSupplier(input)),

  getSuppliers: publicProcedure
    .query(() => getSuppliers()),

  // Purchase Order management
  createPurchaseOrder: publicProcedure
    .input(createPurchaseOrderInputSchema.extend({
      createdBy: z.string() // Clerk user ID from context
    }))
    .mutation(({ input }) => createPurchaseOrder(input, input.createdBy)),

  getPurchaseOrders: publicProcedure
    .query(() => getPurchaseOrders()),

  getPurchaseOrderById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getPurchaseOrderById(input.id)),

  updatePurchaseOrderStatus: publicProcedure
    .input(updatePurchaseOrderStatusInputSchema.extend({
      updatedBy: z.string() // Clerk user ID from context
    }))
    .mutation(({ input }) => updatePurchaseOrderStatus(input, input.updatedBy)),

  generatePONumber: publicProcedure
    .query(() => generatePONumber()),

  // Work Order management
  createWorkOrder: publicProcedure
    .input(createWorkOrderInputSchema.extend({
      createdBy: z.string() // Clerk user ID from context
    }))
    .mutation(({ input }) => createWorkOrder(input, input.createdBy)),

  getWorkOrders: publicProcedure
    .query(() => getWorkOrders()),

  getWorkOrderById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getWorkOrderById(input.id)),

  updateWorkOrder: publicProcedure
    .input(updateWorkOrderInputSchema)
    .mutation(({ input }) => updateWorkOrder(input)),

  completeWorkOrder: publicProcedure
    .input(z.object({
      workOrderId: z.number(),
      actualHours: z.number().nonnegative(),
      completedBy: z.string() // Clerk user ID from context
    }))
    .mutation(({ input }) => completeWorkOrder(input.workOrderId, input.actualHours, input.completedBy)),

  generateWONumber: publicProcedure
    .query(() => generateWONumber()),

  // Stock Adjustment management
  createStockAdjustment: publicProcedure
    .input(createStockAdjustmentInputSchema.extend({
      createdBy: z.string() // Clerk user ID from context
    }))
    .mutation(({ input }) => createStockAdjustment(input, input.createdBy)),

  getStockAdjustments: publicProcedure
    .input(z.object({
      itemId: z.number().optional()
    }))
    .query(({ input }) => getStockAdjustments(input.itemId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      // TODO: Extract user context from Clerk authentication
      // This would include the current user's ID and role for RBAC
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC ERP server listening at port: ${port}`);
}

start();