import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Package, ShoppingCart, Wrench, Users, BarChart3 } from 'lucide-react';

// Import components
import { InventoryManagement } from '@/components/InventoryManagement';
import { PurchaseOrderManagement } from '@/components/PurchaseOrderManagement';
import { WorkOrderManagement } from '@/components/WorkOrderManagement';
import { SupplierManagement } from '@/components/SupplierManagement';
import { UserManagement } from '@/components/UserManagement';
import { Dashboard } from '@/components/Dashboard';

// Import types
import type { Item } from '../../server/src/schema';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lowStockItems, setLowStockItems] = useState<Item[]>([]);
  const [currentUser] = useState({
    id: 'user_clerk_id_demo',
    name: 'Demo User',
    role: 'ADMIN' as const,
    email: 'demo@company.com'
  });

  // Load low stock items for alerts
  const loadLowStockItems = useCallback(async () => {
    try {
      const result = await trpc.getLowStockItems.query({ threshold_multiplier: 1.2 });
      setLowStockItems(result);
    } catch (error) {
      console.error('Failed to load low stock items:', error);
    }
  }, []);

  useEffect(() => {
    loadLowStockItems();
    // Refresh low stock items every 5 minutes
    const interval = setInterval(loadLowStockItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadLowStockItems]);

  const hasPermission = (requiredRole: string) => {
    const roleHierarchy = {
      ADMIN: 4,
      WAREHOUSE_MANAGER: 3,
      PURCHASING_STAFF: 2,
      TECHNICIAN: 1
    };
    return roleHierarchy[currentUser.role as keyof typeof roleHierarchy] >= 
           roleHierarchy[requiredRole as keyof typeof roleHierarchy];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🏭 ERP Management System</h1>
            <p className="text-gray-600">Streamline your business operations</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="px-3 py-1">
              👤 {currentUser.name}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              {currentUser.role}
            </Badge>
          </div>
        </div>

        {/* Low Stock Alerts */}
        {lowStockItems.length > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Low Stock Alert:</strong> {lowStockItems.length} item(s) are running low on stock.
              <span className="ml-2">
                {lowStockItems.slice(0, 3).map(item => item.name).join(', ')}
                {lowStockItems.length > 3 && ` and ${lowStockItems.length - 3} more...`}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 bg-white shadow-sm">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="purchasing" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Purchasing
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Work Orders
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Suppliers
            </TabsTrigger>
            {hasPermission('ADMIN') && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <Dashboard 
              currentUser={currentUser}
              lowStockItems={lowStockItems}
              onTabChange={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <InventoryManagement 
              currentUser={currentUser}
              onStockChange={loadLowStockItems}
            />
          </TabsContent>

          <TabsContent value="purchasing" className="space-y-4">
            <PurchaseOrderManagement 
              currentUser={currentUser}
              canApprove={hasPermission('WAREHOUSE_MANAGER')}
            />
          </TabsContent>

          <TabsContent value="work-orders" className="space-y-4">
            <WorkOrderManagement 
              currentUser={currentUser}
              canAssign={hasPermission('WAREHOUSE_MANAGER')}
            />
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <SupplierManagement 
              currentUser={currentUser}
              canManage={hasPermission('PURCHASING_STAFF')}
            />
          </TabsContent>

          {hasPermission('ADMIN') && (
            <TabsContent value="users" className="space-y-4">
              <UserManagement currentUser={currentUser} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default App;