import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { Plus, Users, Mail, User, Shield, Search, UserCheck, UserX, Crown } from 'lucide-react';

// Import types
import type { User as UserType, CreateUserInput } from '../../../server/src/schema';

interface UserManagementProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<UserType[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // Form state
  const [createForm, setCreateForm] = useState<CreateUserInput>({
    id: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'TECHNICIAN'
  });

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.getUsers.query();
      setUsers(result);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users based on search term, role, and status
  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(user => user.is_active === isActive);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const newUser = await trpc.createUser.mutate(createForm);
      setUsers((prev: UserType[]) => [...prev, newUser]);
      setCreateForm({
        id: '',
        email: '',
        first_name: '',
        last_name: '',
        role: 'TECHNICIAN'
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'bg-purple-100 text-purple-800',
      WAREHOUSE_MANAGER: 'bg-blue-100 text-blue-800',
      PURCHASING_STAFF: 'bg-green-100 text-green-800',
      TECHNICIAN: 'bg-orange-100 text-orange-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return <Crown className="h-4 w-4" />;
      case 'WAREHOUSE_MANAGER': return <Shield className="h-4 w-4" />;
      case 'PURCHASING_STAFF': return <UserCheck className="h-4 w-4" />;
      case 'TECHNICIAN': return <User className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      ADMIN: 'Full system access and user management',
      WAREHOUSE_MANAGER: 'Inventory and work order management',
      PURCHASING_STAFF: 'Purchase orders and supplier management',
      TECHNICIAN: 'Work order execution and completion'
    };
    return descriptions[role] || 'Standard user access';
  };

  const getUserStats = () => {
    const total = users.length;
    const active = users.filter(u => u.is_active).length;
    const inactive = users.filter(u => !u.is_active).length;
    const byRole = {
      ADMIN: users.filter(u => u.role === 'ADMIN').length,
      WAREHOUSE_MANAGER: users.filter(u => u.role === 'WAREHOUSE_MANAGER').length,
      PURCHASING_STAFF: users.filter(u => u.role === 'PURCHASING_STAFF').length,
      TECHNICIAN: users.filter(u => u.role === 'TECHNICIAN').length
    };
    
    return { total, active, inactive, byRole };
  };

  const stats = getUserStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts, roles, and permissions for the ERP system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="WAREHOUSE_MANAGER">Warehouse Manager</SelectItem>
                  <SelectItem value="PURCHASING_STAFF">Purchasing Staff</SelectItem>
                  <SelectItem value="TECHNICIAN">Technician</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <form onSubmit={handleCreateUser}>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Create a new user account with appropriate role and permissions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Alert className="border-blue-200 bg-blue-50">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        User authentication is handled by Clerk.com. Ensure the user ID matches their Clerk account.
                      </AlertDescription>
                    </Alert>
                    
                    <div>
                      <Label htmlFor="user_id">User ID (Clerk ID) *</Label>
                      <Input
                        id="user_id"
                        value={createForm.id}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateForm((prev: CreateUserInput) => ({ ...prev, id: e.target.value }))
                        }
                        placeholder="user_clerk_id_123..."
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This should match the user's Clerk authentication ID
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                          id="first_name"
                          value={createForm.first_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateUserInput) => ({ ...prev, first_name: e.target.value }))
                          }
                          placeholder="John"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                          id="last_name"
                          value={createForm.last_name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateUserInput) => ({ ...prev, last_name: e.target.value }))
                          }
                          placeholder="Doe"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={createForm.email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCreateForm((prev: CreateUserInput) => ({ ...prev, email: e.target.value }))
                        }
                        placeholder="john.doe@company.com"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="role">Role *</Label>
                      <Select
                        value={createForm.role}
                        onValueChange={(value: any) => 
                          setCreateForm((prev: CreateUserInput) => ({ ...prev, role: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TECHNICIAN">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <div>
                                <p>Technician</p>
                                <p className="text-xs text-muted-foreground">Work order execution</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="PURCHASING_STAFF">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              <div>
                                <p>Purchasing Staff</p>
                                <p className="text-xs text-muted-foreground">Purchase orders & suppliers</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="WAREHOUSE_MANAGER">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              <div>
                                <p>Warehouse Manager</p>
                                <p className="text-xs text-muted-foreground">Inventory & work order management</p>
                              </div>
                            </div>
                          </SelectItem>
                          <SelectItem value="ADMIN">
                            <div className="flex items-center gap-2">
                              <Crown className="h-4 w-4" />
                              <div>
                                <p>Administrator</p>
                                <p className="text-xs text-muted-foreground">Full system access</p>
                              </div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Creating...' : 'Create User'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} active, {stats.inactive} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.byRole.ADMIN}</div>
            <p className="text-xs text-muted-foreground">
              Full access
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.byRole.WAREHOUSE_MANAGER}</div>
            <p className="text-xs text-muted-foreground">
              Warehouse operations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff & Technicians</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.byRole.PURCHASING_STAFF + stats.byRole.TECHNICIAN}
            </div>
            <p className="text-xs text-muted-foreground">
              Operational roles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user: UserType) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {user.first_name} {user.last_name}
                          {user.id === currentUser.id && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              You
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {user.id.length > 20 ? `${user.id.substring(0, 20)}...` : user.id}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline">
                        {user.email}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role)}
                      <Badge className={getRoleColor(user.role)}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.is_active ? (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      ) : (
                        <UserX className="h-4 w-4 text-red-600" />
                      )}
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {user.created_at.toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {user.updated_at.toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsViewDialogOpen(true);
                      }}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View User Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedUser?.first_name} {selectedUser?.last_name}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <p className="font-medium">
                    {selectedUser.first_name} {selectedUser.last_name}
                    {selectedUser.id === currentUser.id && (
                      <Badge variant="outline" className="ml-2">
                        Current User
                      </Badge>
                    )}
                  </p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p>
                    <a href={`mailto:${selectedUser.email}`} className="text-blue-600 hover:underline">
                      {selectedUser.email}
                    </a>
                  </p>
                </div>
                <div>
                  <Label>User ID</Label>
                  <p className="font-mono text-sm">{selectedUser.id}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    {selectedUser.is_active ? (
                      <UserCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <UserX className="h-4 w-4 text-red-600" />
                    )}
                    <Badge variant={selectedUser.is_active ? "default" : "secondary"}>
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Role Information */}
              <div className="border-t pt-4">
                <Label>Role & Permissions</Label>
                <div className="flex items-center gap-3 mt-2">
                  {getRoleIcon(selectedUser.role)}
                  <div>
                    <Badge className={getRoleColor(selectedUser.role)}>
                      {selectedUser.role.replace('_', ' ')}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getRoleDescription(selectedUser.role)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label>Account Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.created_at.toLocaleDateString()} at{' '}
                    {selectedUser.created_at.toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <Label>Last Updated</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.updated_at.toLocaleDateString()} at{' '}
                    {selectedUser.updated_at.toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Security Notice */}
              <Alert className="border-blue-200 bg-blue-50">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  User authentication and session management is handled securely by Clerk.com.
                  Role-based access control is enforced throughout the application.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}