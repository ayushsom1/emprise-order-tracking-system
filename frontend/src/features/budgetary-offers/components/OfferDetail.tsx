import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/data-display/StatusBadge";
import { LoadingSpinner } from "../../../components/feedback/LoadingSpinner";
import { format } from "date-fns";
import { Mail, ArrowLeft, Pencil, Trash2, Send, Loader2, FileText, Download, Building, MapPin } from "lucide-react";
// import { useToast } from "../../../hooks/use-toast-app";
import { useOffers } from "../hooks/use-offers";
import { useCustomers, Customer } from "../../customers/hooks/use-customers";
import type { Offer, WorkItem } from "../types/Offer";
import { EmailModal } from "./EmailModal";
import apiClient from "../../../lib/utils/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { getUser } from '../../../lib/utils/auth';

interface User {
  id: string;
  name: string;
  email: string;
}

export function OfferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // const { showError } = useToast();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { submitForApproval, getOffer, deleteOffer } = useOffers();
  const { getCustomer } = useCustomers();
  const [approver, setApprover] = useState<User | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const getCurrentUser = getUser();

  useEffect(() => {
    let mounted = true;
    let isFetching = false;

    const fetchOffer = async () => {
      if (!id || isFetching) return;
      
      try {
        isFetching = true;
        setLoading(true);
        setError(null);
        
        // First try to get the offer details
        const response = await getOffer(id);
        
        if (mounted) {
          setOffer(response);
          
          // If we have a customerId, try to get the customer details
          if (response.customerId) {
            try {
              const customerData = await getCustomer(response.customerId);
              if (mounted) {
                setCustomer(customerData);
              }
            } catch (customerError) {
              console.error('Error fetching customer:', customerError);
              // Continue even if customer fetch fails
            }
          }
          
          // Fetch approver details if available
          if (response.approverId) {
            try {
              const approverResponse = await apiClient.get(`/users/${response.approverId}`);
              if (mounted) {
                setApprover(approverResponse.data);
              }
            } catch (approverError) {
              console.error('Error fetching approver:', approverError);
              // Continue even if approver fetch fails
            }
          }
        }
      } catch (error: any) {
        console.error('Error fetching offer:', error);
        if (mounted) {
          // Check for specific error messages
          if (error.response?.data?.error === "Failed to generate approved document") {
            setError('The offer was approved but the document generation failed. You can still view the offer details.');
          } else {
            setError('Failed to load the budgetary offer details');
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
          isFetching = false;
        }
      }
    };

    fetchOffer();

    return () => {
      mounted = false;
    };
  }, [id]);

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return format(dateObj, "PPP");
    } catch (error) {
      console.error("Error formatting date:", date, error);
      return "Invalid Date";
    }
  };

  const calculateItemTotal = (item: WorkItem): number => {
    if (!item || typeof item.quantity !== 'number' || typeof item.baseRate !== 'number' || typeof item.taxRate !== 'number') {
      return 0;
    }
    return item.quantity * item.baseRate * (1 + item.taxRate / 100);
  };

  const calculateTotal = (workItems: WorkItem[] = []): number => {
    if (!Array.isArray(workItems)) return 0;
    return workItems.reduce((total, item) => total + calculateItemTotal(item), 0);
  };

  const formatCurrency = (value: number): string => {
    return `₹${value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await deleteOffer(id!);
      setDeleteDialogOpen(false);
      navigate('/budgetary-offers');
    } catch (error) {
      console.error('Error deleting offer:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/budgetary-offers/${id}/edit`);
  };

  const handleSubmitForApproval = async () => {
    try {
      setSubmitLoading(true);
      
      if (!getCurrentUser) {
        throw new Error('User not found');
      }
      const currentUser = getCurrentUser;

      // Check if this is an admin submitting their own offer
      const isAdminSelfApproval = currentUser.role === 'ADMIN' && 
        offer?.createdById === currentUser.id;

      await submitForApproval(id!, {
        isAdminAutoApproval: isAdminSelfApproval,
        skipEmail: isAdminSelfApproval
      });

      // Refresh the offer details
      const updatedOffer = await getOffer(id!);
      setOffer(updatedOffer);
    } catch (error) {
      console.error('Error submitting for approval:', error);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-center">
            <p className="text-lg text-muted-foreground mb-2">{error}</p>
            {offer?.customerId && (
              <div className="mb-4 p-4 bg-muted rounded-lg">
                <p className="font-medium text-lg">Customer ID: {offer.customerId}</p>
              </div>
            )}
            {error.includes('document generation failed') && (
              <div className="mt-2 text-sm text-muted-foreground">
                <p>You can still view the offer details below.</p>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/budgetary-offers")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Offers
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!offer) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <p className="text-lg text-muted-foreground">Offer not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/budgetary-offers")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Offers
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section with Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate("/budgetary-offers")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Offers
        </Button>
        <div className="flex space-x-4">
          {offer.status === "DRAFT" && (
            <>
              <Button variant="outline" onClick={handleEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
              <Button 
                onClick={handleSubmitForApproval}
                disabled={submitLoading}
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {getCurrentUser?.role === 'ADMIN' ? 'Auto-approving...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {getCurrentUser?.role === 'ADMIN' ? 'Submit & Auto-approve' : 'Submit for Approval'}
                  </>
                )}
              </Button>
            </>
          )}
          {offer.status === "APPROVED" && (
            <Button onClick={() => setEmailModalOpen(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{offer.subject}</CardTitle>
              {/* <CardDescription>
                Created on {formatDate(offer.createdAt)}
              </CardDescription> */}
            </div>
            <StatusBadge status={offer.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Details */}
          {customer ? (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="text-sm font-medium mb-3">Customer Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Customer Name</div>
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">Code: {customer.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Location</div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="font-medium">{customer.headquarters}</div>
                      {customer.region && (
                        <div className="text-sm text-muted-foreground flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span>{customer.region}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : offer.customerId ? (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="text-sm font-medium mb-3">Customer ID</h3>
              <div className="font-medium">{offer.customerId}</div>
            </div>
          ) : null}

          {/* Offer Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Offer Date
              </h3>
              <p className="mt-1">{formatDate(offer.offerDate)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                To Authority
              </h3>
              <p className="mt-1">{offer.toAuthority}</p>
            </div>
            {/* Add Approver Info */}
            {approver && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Approver
                </h3>
                <p className="mt-1">
                  {approver.name} ({approver.email})
                </p>
              </div>
            )}
            {/* Add Approval Comments */}
            {(offer.status === "APPROVED" || offer.status === "REJECTED") && offer.approvalComments && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {offer.status === "APPROVED" ? "Approved" : "Rejected"} Comments
                </h3>
                <p className="mt-1 p-3 bg-muted rounded-lg">
                  {offer.approvalComments}
                </p>
              </div>
            )}
          </div>

          {/* Work Items with Total Calculation */}
          <div>
            <h3 className="text-lg font-medium mb-4">Work Items</h3>
            <div className="border rounded-lg divide-y">
              {(offer?.workItems || []).map((item: WorkItem, index: number) => {
                const itemTotal = calculateItemTotal(item);
                return (
                  <div key={index} className="p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Description
                        </h4>
                        <p className="mt-1">{item.description || 'N/A'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Quantity & Unit
                          </h4>
                          <p className="mt-1">
                            {item.quantity || 0} {item.unitOfMeasurement || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Base Rate
                          </h4>
                          <p className="mt-1">
                            {formatCurrency(item.baseRate)} per {item.unitOfMeasurement || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Tax Rate
                          </h4>
                          <p className="mt-1">{item.taxRate || 0}%</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Total
                          </h4>
                          <p className="mt-1 font-medium">
                            {formatCurrency(itemTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terms and Conditions with proper HTML rendering */}
          <div>
            <h3 className="text-lg font-medium mb-2">Terms and Conditions</h3>
            <div 
              className="prose prose-sm max-w-none bg-muted p-4 rounded-lg"
              dangerouslySetInnerHTML={{ __html: offer.termsConditions }}
            />
          </div>

          {/* Tags */}
          {offer.tags && offer.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {offer.tags.map((tag, index) => (
                  <div
                    key={index}
                    className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          )}

            {/* Add this new Document section before the Terms and Conditions */}
            {offer.documentUrl && (
            <div>
              <h3 className="text-lg font-medium mb-4">Generated Document</h3>
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Budgetary Offer Document</p>
                  <p className="text-sm text-muted-foreground">
                    Generated PDF document for this offer
                  </p>
                </div>
                <a
                  href={offer.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </a>
              </div>
            </div>
          )}

          {/* Grand Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Grand Total</span>
              <span className="text-2xl font-bold">
                {formatCurrency(calculateTotal(offer?.workItems))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Modal */}
      {emailModalOpen && (
        <EmailModal
          offerId={offer.id}
          open={emailModalOpen}
          onClose={() => setEmailModalOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Offer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this offer? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}