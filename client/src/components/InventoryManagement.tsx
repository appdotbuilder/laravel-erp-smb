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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { Plus, Search, Package, AlertTriangle, Edit, History } from 'lucide-react';

// Import types
import type { Item, CreateItemInput, UpdateItemInput, StockAdjustment, CreateStockAdjustmentInput } from '../../../server/src/schema';

interface InventoryManagementProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  onStockChange: () => void;
}

export function InventoryManagement({ currentUser, onStockChange }: InventoryManagementProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showLowStock, setShowLowStock] = useState(false);

  // Form states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [createForm, setCreateForm] = useState<CreateItemInput>({
    name: '',
    description: null,
    sku: '',
    category: '',
    unit_of_measure: '',
    current_stock: 0,
    min_stock_level: 0,
    unit_cost: 0
  });

  const [editForm, setEditForm] = useState<UpdateItemInput>({
    id: 0,
    name: '',
    description: null,
    sku: '',
    category: '',
    unit_of_measure: '',
    current_stock: 0,
    min_stock_level: 0,
    unit_cost: 0
  });

  const [adjustForm, setAdjustForm] = useState<CreateStockAdjustmentInput>({
    item_id: 0,
    adjustment_type: 'ADJUSTMENT',
    quantity_change: 0,
    reason: ''
  });

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.getItems.query();
      setItems(result);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStockAdjustments = useCallback(async (itemId?: number) => {
    try {
      const result = await trpc.getStockAdjustments.query({ itemId });
      setStockAdjustments(result);
    } catch (error) {
      console.error('Failed to load stock adjustments:', error);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Filter items based on search term, category, and low stock
  useEffect(() => {
    let filtered = items;

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (showLowStock) {
      filtered = filtered.filter(item => item.current_stock <= item.min_stock_level);
    }

    setFilteredItems(filtered);
  }, [items, searchTerm, categoryFilter, showLowStock]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const newItem = await trpc.createItem.mutate(createForm);
      setItems((prev: Item[]) => [...prev, newItem]);
      setCreateForm({
        name: '',
        description: null,
        sku: '',
        category: '',
        unit_of_measure: '',
        current_stock: 0,
        min_stock_level: 0,
        unit_cost: 0
      });
      setIsCreateDialogOpen(false);
      onStockChange();
    } catch (error) {
      console.error('Failed to create item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updatedItem = await trpc.updateItem.mutate(editForm);
      setItems((prev: Item[]) => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
      setIsEditDialogOpen(false);
      setSelectedItem(null);
      onStockChange();
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await trpc.createStockAdjustment.mutate({
        ...adjustForm,
        createdBy: currentUser.id
      });
      await loadItems(); // Reload to get updated stock
      setAdjustForm({
        item_id: 0,
        adjustment_type: 'ADJUSTMENT',
        quantity_change: 0,
        reason: ''
      });
      setIsAdjustDialogOpen(false);
      setSelectedItem(null);
      onStockChange();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (item: Item) => {
    setSelectedItem(item);
    setEditForm({
      id: item.id,
      name: item.name,
      description: item.description,
      sku: item.sku,
      category: item.category,
      unit_of_measure: item.unit_of_measure,
      current_stock: item.current_stock,
      min_stock_level: item.min_stock_level,
      unit_cost: item.unit_cost,
      is_active: item.is_active
    });
    setIsEditDialogOpen(true);
  };

  const openAdjustDialog = (item: Item) => {
    setSelectedItem(item);
    setAdjustForm({
      item_id: item.id,
      adjustment_type: 'ADJUSTMENT',
      quantity_change: 0,
      reason: ''
    });
    setIsAdjustDialogOpen(true);
  };

  const openHistoryDialog = async (item: Item) => {
    setSelectedItem(item);
    await loadStockAdjustments(item.id);
    setIsHistoryDialogOpen(true);
  };

  const getUniqueCategories = () => {
    return [...new Set(items.map(item => item.category))];
  };

  const getStockStatusColor = (item: Item) => {
    if (item.current_stock <= item.min_stock_level) {
      return 'bg-red-100 text-red-800';
    } else if (item.current_stock <= item.min_stock_level * 1.5) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Management
          </CardTitle>
          <CardDescription>
            Manage your inventory items, track stock levels, and adjust quantities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items by name, SKU, or category..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {getUniqueCategories().map((category: string) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showLowStock ? "default" : "outline"}
                onClick={() => setShowLowStock(!showLowStock)}
                className="flex items-center gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                Low Stock Only
              </Button>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleCreateItem}>
                  <DialogHeader>
                    <DialogTitle>Add New Item</DialogTitle>
                    <DialogDescription>
                      Create a new inventory item with initial stock levels
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={createForm.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateItemInput) => ({ ...prev, name: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="sku">SKU *</Label>
                        <Input
                          id="sku"
                          value={createForm.sku}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateItemInput) => ({ ...prev, sku: e.target.value }))
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={createForm.description || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setCreateForm((prev: CreateItemInput) => ({ ...prev, description: e.target.value || null }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category">Category *</Label>
                        <Input
                          id="category"
                          value={createForm.category}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateItemInput) => ({ ...prev, category: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit_of_measure">Unit of Measure *</Label>
                        <Input
                          id="unit_of_measure"
                          value={createForm.unit_of_measure}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateItemInput) => ({ ...prev, unit_of_measure: e.target.value }))
                          }
                          placeholder="e.g., pieces, kg, liters"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="current_stock">Current Stock *</Label>
                        <Input
                          id="current_stock"
                          type="number"
                          min="0"
                          value={createForm.current_stock}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateItemInput) => ({ ...prev, current_stock: parseInt(e.target.value) || 0 }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="min_stock_level">Min Stock Level *</Label>
                        <Input
                          id="min_stock_level"
                          type="number"
                          min="0"
                          value={createForm.min_stock_level}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateItemInput) => ({ ...prev, min_stock_level: parseInt(e.target.value) || 0 }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit_cost">Unit Cost *</Label>
                        <Input
                          id="unit_cost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={createForm.unit_cost}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateItemInput) => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Item'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({filteredItems.length})</CardTitle>
          {showLowStock && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Showing items with stock at or below minimum levels
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock Status</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item: Item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{item.sku}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={getStockStatusColor(item)}>
                        {item.current_stock} {item.unit_of_measure}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Min: {item.min_stock_level} {item.unit_of_measure}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>${item.unit_cost.toFixed(2)}</TableCell>
                  <TableCell>${(item.current_stock * item.unit_cost).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAdjustDialog(item)}
                      >
                        Adjust
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openHistoryDialog(item)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Item Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleEditItem}>
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>
                Update item details and stock levels
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_name">Name *</Label>
                  <Input
                    id="edit_name"
                    value={editForm.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditForm((prev: UpdateItemInput) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_sku">SKU *</Label>
                  <Input
                    id="edit_sku"
                    value={editForm.sku}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditForm((prev: UpdateItemInput) => ({ ...prev, sku: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_current_stock">Current Stock *</Label>
                  <Input
                    id="edit_current_stock"
                    type="number"
                    min="0"
                    value={editForm.current_stock}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditForm((prev: UpdateItemInput) => ({ ...prev, current_stock: parseInt(e.target.value) || 0 }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_min_stock_level">Min Stock Level *</Label>
                  <Input
                    id="edit_min_stock_level"
                    type="number"
                    min="0"
                    value={editForm.min_stock_level}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditForm((prev: UpdateItemInput) => ({ ...prev, min_stock_level: parseInt(e.target.value) || 0 }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_unit_cost">Unit Cost *</Label>
                  <Input
                    id="edit_unit_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.unit_cost}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditForm((prev: UpdateItemInput) => ({ ...prev, unit_cost: parseFloat(e.target.value) || 0 }))
                    }
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <form onSubmit={handleStockAdjustment}>
            <DialogHeader>
              <DialogTitle>Adjust Stock - {selectedItem?.name}</DialogTitle>
              <DialogDescription>
                Current stock: {selectedItem?.current_stock} {selectedItem?.unit_of_measure}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="adjustment_type">Adjustment Type</Label>
                <Select 
                  value={adjustForm.adjustment_type} 
                  onValueChange={(value: any) => setAdjustForm((prev: CreateStockAdjustmentInput) => ({ ...prev, adjustment_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADJUSTMENT">Manual Adjustment</SelectItem>
                    <SelectItem value="RECEIVED">Stock Received</SelectItem>
                    <SelectItem value="CONSUMED">Stock Consumed</SelectItem>
                    <SelectItem value="DAMAGED">Damaged Stock</SelectItem>
                    <SelectItem value="LOST">Lost Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity_change">Quantity Change</Label>
                <Input
                  id="quantity_change"
                  type="number"
                  value={adjustForm.quantity_change}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAdjustForm((prev: CreateStockAdjustmentInput) => ({ ...prev, quantity_change: parseInt(e.target.value) || 0 }))
                  }
                  placeholder="Use negative numbers to reduce stock"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  New stock will be: {(selectedItem?.current_stock || 0) + adjustForm.quantity_change} {selectedItem?.unit_of_measure}
                </p>
              </div>
              <div>
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  value={adjustForm.reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setAdjustForm((prev: CreateStockAdjustmentInput) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Explain the reason for this adjustment..."
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Adjusting...' : 'Adjust Stock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Stock History - {selectedItem?.name}</DialogTitle>
            <DialogDescription>
              Complete audit trail of stock adjustments
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Previous</TableHead>
                  <TableHead>New</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockAdjustments.map((adjustment: StockAdjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>{adjustment.created_at.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{adjustment.adjustment_type}</Badge>
                    </TableCell>
                    <TableCell className={adjustment.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {adjustment.quantity_change >= 0 ? '+' : ''}{adjustment.quantity_change}
                    </TableCell>
                    <TableCell>{adjustment.previous_stock}</TableCell>
                    <TableCell>{adjustment.new_stock}</TableCell>
                    <TableCell>{adjustment.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}