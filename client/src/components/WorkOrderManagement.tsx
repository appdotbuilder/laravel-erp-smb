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
import { Plus, Wrench, Eye, Play, CheckCircle, X, Clock, User, AlertTriangle } from 'lucide-react';

// Import types
import type { WorkOrder, Item, User as UserType, CreateWorkOrderInput, UpdateWorkOrderInput } from '../../../server/src/schema';

interface WorkOrderManagementProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  canAssign: boolean;
}

export function WorkOrderManagement({ currentUser, canAssign }: WorkOrderManagementProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [woNumber, setWONumber] = useState('');
  const [actualHours, setActualHours] = useState(0);

  // Form state
  const [createForm, setCreateForm] = useState<CreateWorkOrderInput>({
    title: '',
    description: null,
    priority: 'MEDIUM',
    assigned_to: null,
    estimated_hours: null,
    due_date: null,
    items: []
  });

  const [selectedItems, setSelectedItems] = useState<Array<{
    item_id: number;
    quantity_planned: number;
  }>>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [woResult, itemsResult, usersResult] = await Promise.all([
        trpc.getWorkOrders.query(),
        trpc.getItems.query(),
        trpc.getUsers.query()
      ]);
      setWorkOrders(woResult);
      setItems(itemsResult);
      setUsers(usersResult);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateWONumber = useCallback(async () => {
    try {
      const result = await trpc.generateWONumber.query();
      setWONumber(result);
    } catch (error) {
      console.error('Failed to generate WO number:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isCreateDialogOpen) {
      generateWONumber();
    }
  }, [isCreateDialogOpen, generateWONumber]);

  const handleCreateWO = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const newWO = await trpc.createWorkOrder.mutate({
        ...createForm,
        items: selectedItems,
        createdBy: currentUser.id
      });
      setWorkOrders((prev: WorkOrder[]) => [newWO, ...prev]);
      
      // Reset form
      setCreateForm({
        title: '',
        description: null,
        priority: 'MEDIUM',
        assigned_to: null,
        estimated_hours: null,
        due_date: null,
        items: []
      });
      setSelectedItems([]);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create work order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (woId: number, newStatus: string) => {
    setIsLoading(true);
    try {
      const updateData: UpdateWorkOrderInput = {
        id: woId,
        status: newStatus as any
      };

      if (newStatus === 'IN_PROGRESS') {
        // Auto-assign to current user if not assigned
        const wo = workOrders.find(w => w.id === woId);
        if (!wo?.assigned_to) {
          updateData.assigned_to = currentUser.id;
        }
      }

      await trpc.updateWorkOrder.mutate(updateData);
      await loadData(); // Reload to get updated data
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWO) return;

    setIsLoading(true);
    try {
      await trpc.completeWorkOrder.mutate({
        workOrderId: selectedWO.id,
        actualHours,
        completedBy: currentUser.id
      });
      await loadData(); // Reload to get updated data
      setIsCompleteDialogOpen(false);
      setSelectedWO(null);
      setActualHours(0);
    } catch (error) {
      console.error('Failed to complete work order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addItemToWO = () => {
    setSelectedItems([...selectedItems, {
      item_id: 0,
      quantity_planned: 1
    }]);
  };

  const removeItemFromWO = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateSelectedItem = (index: number, field: string, value: any) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedItems(updated);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      CREATED: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-orange-100 text-orange-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'bg-gray-100 text-gray-800',
      MEDIUM: 'bg-blue-100 text-blue-800',
      HIGH: 'bg-orange-100 text-orange-800',
      URGENT: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown User';
  };

  const getItemName = (itemId: number) => {
    const item = items.find(i => i.id === itemId);
    return item?.name || 'Unknown Item';
  };

  const isOverdue = (dueDate: Date | null) => {
    if (!dueDate) return false;
    return new Date() > dueDate;
  };

  let filteredWOs = workOrders;
  if (statusFilter !== 'all') {
    filteredWOs = filteredWOs.filter(wo => wo.status === statusFilter);
  }
  if (priorityFilter !== 'all') {
    filteredWOs = filteredWOs.filter(wo => wo.priority === priorityFilter);
  }

  const technicians = users.filter(user => user.role === 'TECHNICIAN' || user.role === 'ADMIN');

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Work Order Management
          </CardTitle>
          <CardDescription>
            Create, assign, and track maintenance and operational work orders
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
                  <SelectItem value="CREATED">Created</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Work Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleCreateWO}>
                  <DialogHeader>
                    <DialogTitle>Create Work Order</DialogTitle>
                    <DialogDescription>
                      WO Number: {woNumber}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    {/* Basic Information */}
                    <div>
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={createForm.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateForm((prev: CreateWorkOrderInput) => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="Brief description of the work to be done"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={createForm.description || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setCreateForm((prev: CreateWorkOrderInput) => ({ ...prev, description: e.target.value || null }))
                        }
                        placeholder="Detailed description of the work order..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="priority">Priority *</Label>
                        <Select
                          value={createForm.priority}
                          onValueChange={(value: any) => 
                            setCreateForm((prev: CreateWorkOrderInput) => ({ ...prev, priority: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">Low</SelectItem>
                            <SelectItem value="MEDIUM">Medium</SelectItem>
                            <SelectItem value="HIGH">High</SelectItem>
                            <SelectItem value="URGENT">🚨 Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="assigned_to">Assign to Technician</Label>
                        <Select
                          value={createForm.assigned_to || ''}
                          onValueChange={(value: string) => 
                            setCreateForm((prev: CreateWorkOrderInput) => ({ ...prev, assigned_to: value || null }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {technicians.map((user: UserType) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.first_name} {user.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="estimated_hours">Estimated Hours</Label>
                        <Input
                          id="estimated_hours"
                          type="number"
                          min="0"
                          step="0.5"
                          value={createForm.estimated_hours || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateWorkOrderInput) => ({ 
                              ...prev, 
                              estimated_hours: e.target.value ? parseFloat(e.target.value) : null 
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="due_date">Due Date</Label>
                        <Input
                          id="due_date"
                          type="datetime-local"
                          value={createForm.due_date?.toISOString().slice(0, 16) || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateWorkOrderInput) => ({
                              ...prev,
                              due_date: e.target.value ? new Date(e.target.value) : null
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Items Section */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <Label>Required Items (Optional)</Label>
                        <Button type="button" variant="outline" onClick={addItemToWO}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                      
                      {selectedItems.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          No items required or add items that will be consumed during this work.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {selectedItems.map((selectedItem, index) => (
                            <div key={index} className="grid grid-cols-4 gap-4 p-4 border rounded">
                              <div className="col-span-2">
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
                                        {item.name} ({item.sku}) - Stock: {item.current_stock}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Quantity Needed</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={selectedItem.quantity_planned}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateSelectedItem(index, 'quantity_planned', parseInt(e.target.value) || 1)
                                  }
                                />
                              </div>
                              <div className="flex items-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeItemFromWO(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create Work Order'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Work Orders ({filteredWOs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WO Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWOs.map((wo: WorkOrder) => (
                <TableRow key={wo.id}>
                  <TableCell className="font-mono">{wo.wo_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{wo.title}</p>
                      {wo.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {wo.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(wo.priority)}>
                      {wo.priority === 'URGENT' && '🚨 '}
                      {wo.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(wo.status)}>
                      {wo.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {getUserName(wo.assigned_to)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {wo.due_date ? (
                      <div className={`flex items-center gap-2 ${isOverdue(wo.due_date) && wo.status !== 'COMPLETED' ? 'text-red-600' : ''}`}>
                        {isOverdue(wo.due_date) && wo.status !== 'COMPLETED' && (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {wo.due_date.toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {wo.estimated_hours && (
                        <p>Est: {wo.estimated_hours}h</p>
                      )}
                      {wo.actual_hours && (
                        <p>Actual: {wo.actual_hours}h</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedWO(wo);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {wo.status === 'CREATED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(wo.id, 'IN_PROGRESS')}
                          disabled={isLoading}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {wo.status === 'IN_PROGRESS' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedWO(wo);
                            setActualHours(wo.estimated_hours || 0);
                            setIsCompleteDialogOpen(true);
                          }}
                          disabled={isLoading}
                        >
                          <CheckCircle className="h-4 w-4" />
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

      {/* View WO Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Work Order Details</DialogTitle>
            <DialogDescription>
              {selectedWO?.wo_number}
            </DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Title</Label>
                  <p className="font-medium">{selectedWO.title}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(selectedWO.status)}>
                    {selectedWO.status}
                  </Badge>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Badge className={getPriorityColor(selectedWO.priority)}>
                    {selectedWO.priority}
                  </Badge>
                </div>
                <div>
                  <Label>Assigned To</Label>
                  <p>{getUserName(selectedWO.assigned_to)}</p>
                </div>
                <div>
                  <Label>Created Date</Label>
                  <p>{selectedWO.created_at.toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Due Date</Label>
                  <p>
                    {selectedWO.due_date
                      ? selectedWO.due_date.toLocaleDateString()
                      : 'Not set'
                    }
                  </p>
                </div>
              </div>
              {selectedWO.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm text-muted-foreground">{selectedWO.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Estimated Hours</Label>
                  <p>{selectedWO.estimated_hours || 'Not set'}</p>
                </div>
                <div>
                  <Label>Actual Hours</Label>
                  <p>{selectedWO.actual_hours || 'Not completed'}</p>
                </div>
              </div>
              {selectedWO.completed_date && (
                <div>
                  <Label>Completed Date</Label>
                  <p>{selectedWO.completed_date.toLocaleDateString()}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete WO Dialog */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCompleteWorkOrder}>
            <DialogHeader>
              <DialogTitle>Complete Work Order</DialogTitle>
              <DialogDescription>
                {selectedWO?.wo_number} - {selectedWO?.title}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="actual_hours">Actual Hours Worked *</Label>
                <Input
                  id="actual_hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={actualHours}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setActualHours(parseFloat(e.target.value) || 0)
                  }
                  required
                />
                {selectedWO?.estimated_hours && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated: {selectedWO.estimated_hours} hours
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ Completing this work order will automatically deduct any planned items from inventory.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Completing...' : 'Complete Work Order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}