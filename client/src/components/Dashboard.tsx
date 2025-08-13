import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trpc } from '@/utils/trpc';
import { 
  Package, 
  ShoppingCart, 
  Wrench, 
  AlertTriangle,
  TrendingUp,
  Users,
  DollarSign,
  Clock
} from 'lucide-react';

// Import types
import type { Item, PurchaseOrder, WorkOrder } from '../../../server/src/schema';

interface DashboardProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  lowStockItems: Item[];
  onTabChange: (tab: string) => void;
}

export function Dashboard({ currentUser, lowStockItems, onTabChange }: DashboardProps) {
  const [stats, setStats] = useState({
    totalItems: 0,
    pendingPOs: 0,
    activePOs: 0,
    activeWorkOrders: 0,
    completedWorkOrders: 0,
    totalValue: 0
  });
  const [recentPOs, setRecentPOs] = useState<PurchaseOrder[]>([]);
  const [recentWorkOrders, setRecentWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, purchaseOrders, workOrders] = await Promise.all([
        trpc.getItems.query(),
        trpc.getPurchaseOrders.query(),
        trpc.getWorkOrders.query()
      ]);

      // Calculate stats
      const totalValue = items.reduce((sum, item) => sum + (item.current_stock * item.unit_cost), 0);
      const pendingPOs = purchaseOrders.filter(po => po.status === 'PENDING' || po.status === 'DRAFT').length;
      const activePOs = purchaseOrders.filter(po => po.status === 'APPROVED' || po.status === 'ORDERED').length;
      const activeWOs = workOrders.filter(wo => wo.status === 'CREATED' || wo.status === 'IN_PROGRESS').length;
      const completedWOs = workOrders.filter(wo => wo.status === 'COMPLETED').length;

      setStats({
        totalItems: items.length,
        pendingPOs,
        activePOs,
        activeWorkOrders: activeWOs,
        completedWorkOrders: completedWOs,
        totalValue
      });

      // Get recent records (last 5)
      setRecentPOs(purchaseOrders.slice(0, 5));
      setRecentWorkOrders(workOrders.slice(0, 5));

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      ORDERED: 'bg-purple-100 text-purple-800',
      RECEIVED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      CREATED: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-orange-100 text-orange-800',
      COMPLETED: 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back, {currentUser.name}! 👋</CardTitle>
          <CardDescription className="text-blue-100">
            Here's what's happening in your business today
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onTabChange('inventory')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <p className="text-xs text-muted-foreground">
              {lowStockItems.length} running low
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onTabChange('purchasing')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPOs}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activePOs} active orders
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onTabChange('work-orders')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Work Orders</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeWorkOrders}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedWorkOrders} completed
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Current stock value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Items ({lowStockItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStockItems.slice(0, 6).map((item: Item) => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-white rounded">
                  <span className="font-medium">{item.name}</span>
                  <Badge variant="outline" className="text-orange-600">
                    {item.current_stock} left
                  </Badge>
                </div>
              ))}
            </div>
            {lowStockItems.length > 6 && (
              <Button 
                variant="outline" 
                className="mt-2 text-orange-600"
                onClick={() => onTabChange('inventory')}
              >
                View all {lowStockItems.length} items
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Purchase Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Recent Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPOs.length === 0 ? (
              <p className="text-muted-foreground">No purchase orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentPOs.map((po: PurchaseOrder) => (
                  <div key={po.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{po.po_number}</p>
                      <p className="text-sm text-muted-foreground">
                        ${po.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <Badge className={getStatusColor(po.status)}>
                      {po.status}
                    </Badge>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => onTabChange('purchasing')}
                >
                  View All Purchase Orders
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Work Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Recent Work Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentWorkOrders.length === 0 ? (
              <p className="text-muted-foreground">No work orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentWorkOrders.map((wo: WorkOrder) => (
                  <div key={wo.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{wo.wo_number}</p>
                      <p className="text-sm text-muted-foreground">{wo.title}</p>
                    </div>
                    <Badge className={getStatusColor(wo.status)}>
                      {wo.status}
                    </Badge>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => onTabChange('work-orders')}
                >
                  View All Work Orders
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}