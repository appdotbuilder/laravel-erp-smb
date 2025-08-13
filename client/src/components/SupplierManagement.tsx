import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { Plus, Users, Mail, Phone, MapPin, Building, Search, Shield } from 'lucide-react';

// Import types
import type { Supplier, CreateSupplierInput } from '../../../server/src/schema';

interface SupplierManagementProps {
  currentUser: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  canManage: boolean;
}

export function SupplierManagement({ currentUser, canManage }: SupplierManagementProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form state
  const [createForm, setCreateForm] = useState<CreateSupplierInput>({
    name: '',
    contact_person: null,
    email: null,
    phone: null,
    address: null,
    payment_info: null
  });

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await trpc.getSuppliers.query();
      setSuppliers(result);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Filter suppliers based on search term and active status
  useEffect(() => {
    let filtered = suppliers;

    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (supplier.contact_person && supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (showInactiveOnly) {
      filtered = filtered.filter(supplier => !supplier.is_active);
    }

    setFilteredSuppliers(filtered);
  }, [suppliers, searchTerm, showInactiveOnly]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const newSupplier = await trpc.createSupplier.mutate(createForm);
      setSuppliers((prev: Supplier[]) => [...prev, newSupplier]);
      setCreateForm({
        name: '',
        contact_person: null,
        email: null,
        phone: null,
        address: null,
        payment_info: null
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create supplier:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSupplierStats = () => {
    const active = suppliers.filter(s => s.is_active).length;
    const inactive = suppliers.filter(s => !s.is_active).length;
    const withPaymentInfo = suppliers.filter(s => s.encrypted_payment_info).length;
    
    return { active, inactive, withPaymentInfo };
  };

  const stats = getSupplierStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Supplier Management
          </CardTitle>
          <CardDescription>
            Manage supplier information, contacts, and payment details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers by name, contact, or email..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                variant={showInactiveOnly ? "default" : "outline"}
                onClick={() => setShowInactiveOnly(!showInactiveOnly)}
              >
                Inactive Only
              </Button>
            </div>
            {canManage && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Supplier
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <form onSubmit={handleCreateSupplier}>
                    <DialogHeader>
                      <DialogTitle>Add New Supplier</DialogTitle>
                      <DialogDescription>
                        Create a new supplier record with contact and payment information
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label htmlFor="name">Company Name *</Label>
                        <Input
                          id="name"
                          value={createForm.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateSupplierInput) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="Enter company name"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="contact_person">Contact Person</Label>
                          <Input
                            id="contact_person"
                            value={createForm.contact_person || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateForm((prev: CreateSupplierInput) => ({ ...prev, contact_person: e.target.value || null }))
                            }
                            placeholder="Primary contact name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={createForm.email || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateForm((prev: CreateSupplierInput) => ({ ...prev, email: e.target.value || null }))
                            }
                            placeholder="contact@supplier.com"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={createForm.phone || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCreateForm((prev: CreateSupplierInput) => ({ ...prev, phone: e.target.value || null }))
                          }
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>

                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                          id="address"
                          value={createForm.address || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setCreateForm((prev: CreateSupplierInput) => ({ ...prev, address: e.target.value || null }))
                          }
                          placeholder="Complete business address"
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label htmlFor="payment_info">Payment Information</Label>
                        <Textarea
                          id="payment_info"
                          value={createForm.payment_info || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setCreateForm((prev: CreateSupplierInput) => ({ ...prev, payment_info: e.target.value || null }))
                          }
                          placeholder="Payment terms, account details, etc. (will be encrypted)"
                          rows={2}
                        />
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          This information will be securely encrypted
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Supplier'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Suppliers</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              Ready for business
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Suppliers</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">
              Currently inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Payment Info</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withPaymentInfo}</div>
            <p className="text-xs text-muted-foreground">
              Payment details secured
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers ({filteredSuppliers.length})</CardTitle>
          {showInactiveOnly && (
            <Alert className="border-gray-200 bg-gray-50">
              <AlertDescription className="text-gray-800">
                Showing inactive suppliers only
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Info</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier: Supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{supplier.name}</p>
                        <p className="text-sm text-muted-foreground">ID: {supplier.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {supplier.contact_person ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {supplier.contact_person}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                            {supplier.email}
                          </a>
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">
                            {supplier.phone}
                          </a>
                        </div>
                      )}
                      {!supplier.email && !supplier.phone && (
                        <span className="text-muted-foreground text-sm">No contact info</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.is_active ? "default" : "secondary"}>
                      {supplier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      {supplier.encrypted_payment_info ? (
                        <Badge variant="outline" className="text-green-600">
                          Secured
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {supplier.created_at.toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSupplier(supplier);
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

      {/* View Supplier Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Supplier Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedSupplier?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedSupplier && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Company Name</Label>
                  <p className="font-medium">{selectedSupplier.name}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={selectedSupplier.is_active ? "default" : "secondary"}>
                    {selectedSupplier.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <p>{selectedSupplier.contact_person || 'Not provided'}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p>
                    {selectedSupplier.email ? (
                      <a href={`mailto:${selectedSupplier.email}`} className="text-blue-600 hover:underline">
                        {selectedSupplier.email}
                      </a>
                    ) : (
                      'Not provided'
                    )}
                  </p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p>
                    {selectedSupplier.phone ? (
                      <a href={`tel:${selectedSupplier.phone}`} className="text-blue-600 hover:underline">
                        {selectedSupplier.phone}
                      </a>
                    ) : (
                      'Not provided'
                    )}
                  </p>
                </div>
                <div>
                  <Label>Payment Information</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    {selectedSupplier.encrypted_payment_info ? (
                      <Badge variant="outline" className="text-green-600">
                        Encrypted & Secured
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              {selectedSupplier.address && (
                <div>
                  <Label>Address</Label>
                  <div className="flex items-start gap-2 mt-1">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm">{selectedSupplier.address}</p>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label>Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedSupplier.created_at.toLocaleDateString()} at{' '}
                    {selectedSupplier.created_at.toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <Label>Last Updated</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedSupplier.updated_at.toLocaleDateString()} at{' '}
                    {selectedSupplier.updated_at.toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Security Notice */}
              <Alert className="border-blue-200 bg-blue-50">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  All sensitive payment information is encrypted using industry-standard security measures.
                  Only authorized personnel can access this data.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}