import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Package,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  BarChart3,
  ShoppingCart,
  Edit,
  MoreVertical,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Truck,
  Pill,
  Stethoscope,
  Archive,
  Eye,
  Download,
  Upload,
  RefreshCw,
  Settings,
  Users,
  Building2,
  Trash2,
  Loader2,
  Printer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import AddItemDialog from "@/components/inventory/add-item-dialog";
import StockAdjustmentDialog from "@/components/inventory/stock-adjustment-dialog";
import PurchaseOrderDialog from "../components/inventory/purchase-order-dialog";
import GoodsReceiptDialog from "../components/inventory/goods-receipt-dialog";
import PharmacySales from "@/components/inventory/pharmacy-sales";
import ReturnsManagement from "@/components/inventory/returns-management";
import { ShoppingBag, RotateCcw } from "lucide-react";

// 1. Item Master Interface
interface InventoryItem {
  id: number; // Unique identifier
  name: string; // Item Name
  description?: string;
  sku: string;
  barcode?: string;
  brandName?: string;
  manufacturer?: string;
  categoryId: number;
  categoryName?: string; // Category (Medicine/Equipment)
  unitOfMeasurement: string; // Unit of Measurement (Strip, Bottle, etc.)
  purchasePrice: string;
  salePrice: string;
  mrp?: string;
  currentStock: number;
  minimumStock: number;
  reorderPoint: number; // Reorder Level (To prevent stockouts)
  prescriptionRequired: boolean;
  isActive: boolean;
  stockValue: number;
  isLowStock: boolean;
  expiryDate?: string; // Expiry Date (Critical for medicines)
  createdAt: string;
  updatedAt: string;
}

// 2. Stock/Inventory Table Interface
interface StockEntry {
  id: number;
  itemId: number; // Link to Item Master
  itemName: string;
  batchNumber: string; // Batch Number (For traceability)
  quantityAvailable: number; // Current stock
  location: string; // Location/Department (Pharmacy/Ward)
  expiryDate: string; // Expiry Date & Batch Number (For traceability)
  manufactureDate?: string;
  supplierId?: number;
  supplierName?: string;
  purchasePrice: string;
  receivedDate: string;
  isExpired: boolean;
}

interface InventoryCategory {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
}

// 3. Purchase Orders (POs) Interface
interface PurchaseOrder {
  id: number;
  poNumber: string; // PO Number
  supplierId: number; // Supplier ID
  supplierName: string;
  supplierEmail?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  status: string; // Status (Ordered/Received)
  totalAmount: string;
  taxAmount?: string; // Tax Amount
  notes?: string; // Notes
  itemsOrdered: PurchaseOrderItem[]; // Items Ordered (List with quantities)
  emailSent: boolean;
  emailSentAt?: string;
  createdAt: string;
  createdBy: number;
  approvedBy?: number;
  approvedAt?: string;
}

interface PurchaseOrderItem {
  id: number;
  itemId: number;
  itemName: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  receivedQuantity: number;
}

// 4. Goods Receipt Interface
interface GoodsReceipt {
  id: number;
  receiptNumber: string; // Receipt Number
  purchaseOrderId: number;
  poNumber: string;
  supplierName: string; // Supplier Name
  receivedDate: string;
  itemsReceived: GoodsReceiptItem[]; // Items Received (With batch/expiry)
  totalAmount: string;
  receivedBy: number;
  notes?: string;
}

interface GoodsReceiptItem {
  id: number;
  itemId: number;
  itemName: string;
  quantityReceived: number;
  batchNumber: string; // Batch Number
  expiryDate: string; // Expiry Date
  manufactureDate?: string;
  unitPrice: string;
  totalPrice: string;
}

interface GoodsReceiptDetail {
  id: number;
  receiptNumber: string;
  purchaseOrderId?: number;
  poNumber?: string | null;
  supplierName?: string | null;
  receivedDate: string;
  totalAmount: number;
  notes?: string | null;
  items: Array<{
    itemId: number;
    itemName: string;
    quantity: number;
    unitPrice: string;
  }>;
  purchaseOrder?: {
    id: number;
    poNumber: string;
    orderDate: string;
    expectedDeliveryDate?: string | null;
    status: string;
    totalAmount: number;
    taxAmount: number;
    discountAmount: number;
    notes?: string | null;
    supplierId: number;
    supplierName?: string | null;
    supplierEmail?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  purchaseOrderItems?: Array<{
    id: number;
    itemId: number;
    itemName: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    receivedQuantity: number;
  }>;
}

// 5. Alerts Interface
interface StockAlert {
  id: number;
  alertType: string; // Low Stock / Expiry Alerts
  message: string;
  isRead: boolean;
  isResolved: boolean;
  createdAt: string;
  itemId: number;
  itemName: string;
  itemSku: string;
  currentStock?: number;
  minimumStock?: number;
  expiryDate?: string; // For expiry alerts
  batchNumber?: string; // For batch-specific alerts
}

interface InventoryValue {
  totalValue: string;
  totalItems: number;
  totalStock: number;
  lowStockItems: number;
  expiringItems: number;
  expiredItems: number;
}

interface LowStockItem {
  id: number;
  name: string;
  sku: string;
  currentStock: number;
  minimumStock: number;
  reorderPoint: number;
  categoryName?: string;
}

export default function Inventory() {
  const { canCreate, canEdit, canDelete, getUserRole, isAdmin, isDoctor, isNurse } = useRolePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    number | undefined
  >();
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showPODialog, setShowPODialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [selectedPurchaseOrderIdForReceipt, setSelectedPurchaseOrderIdForReceipt] = useState<number | undefined>(undefined);
  const [showGoodsReceiptDetails, setShowGoodsReceiptDetails] = useState(false);
  const [selectedGoodsReceiptId, setSelectedGoodsReceiptId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showPODetailsDialog, setShowPODetailsDialog] = useState(false);
  const [showItemDetailsDialog, setShowItemDetailsDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedPOForEmail, setSelectedPOForEmail] =
    useState<PurchaseOrder | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [activeTab, setActiveTab] = useState("item-master");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [showDeleteGoodsReceiptModal, setShowDeleteGoodsReceiptModal] = useState(false);
  const [goodsReceiptToDelete, setGoodsReceiptToDelete] = useState<number | null>(null);
  const [showDeleteGoodsReceiptSuccess, setShowDeleteGoodsReceiptSuccess] = useState(false);
  
  // PDF Viewer state
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedReceiptForPdf, setSelectedReceiptForPdf] = useState<GoodsReceipt | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Item Master Data
  const {
    data: items = [],
    isLoading: itemsLoading,
    error: itemsError,
  } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/items");
      return response.json();
    },
    retry: 3,
  });

  // 2. Stock/Inventory Data
  const { data: stockEntries = [], isLoading: stockLoading } = useQuery<
    StockEntry[]
  >({
    queryKey: ["/api/inventory/batches"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/batches");
      return response.json();
    },
    retry: 3,
  });

  // 3. Purchase Orders Data
  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery<
    PurchaseOrder[]
  >({
    queryKey: ["/api/inventory/purchase-orders"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/inventory/purchase-orders",
      );
      return response.json();
    },
    retry: 3,
  });

  // 4. Goods Receipt Data
  const { data: goodsReceiptsRaw = [], isLoading: receiptLoading } = useQuery<
    any[]
  >({
    queryKey: ["/api/inventory/goods-receipts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/goods-receipts");
      return response.json();
    },
    retry: 3,
  });

  // Group receipts by ID and calculate totals
  const goodsReceipts = useMemo(() => {
    const grouped = new Map<number, GoodsReceipt>();
    
    goodsReceiptsRaw.forEach((item: any) => {
      const receiptId = item.id;
      if (!grouped.has(receiptId)) {
        grouped.set(receiptId, {
          id: receiptId,
          receiptNumber: item.receiptNumber,
          purchaseOrderId: item.purchaseOrderId,
          poNumber: item.poNumber,
          supplierName: item.supplierName,
          receivedDate: item.receivedDate,
          itemsReceived: [],
          totalAmount: "0",
          receivedBy: item.receivedBy,
          notes: item.notes,
        });
      }
      
      const receipt = grouped.get(receiptId)!;
      if (item.itemId && item.itemName) {
        receipt.itemsReceived.push({
          itemId: item.itemId,
          itemName: item.itemName,
          quantityReceived: item.quantityReceived || 0,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
        });
      }
      
      // Store purchase order total amount if available (use first item's poTotalAmount)
      if (item.poTotalAmount != null && receipt.totalAmount === "0") {
        const poTotal = typeof item.poTotalAmount === 'number' ? item.poTotalAmount : parseFloat(String(item.poTotalAmount || "0"));
        if (!isNaN(poTotal) && poTotal > 0) {
          receipt.totalAmount = poTotal.toFixed(2);
        }
      }
      
      // Calculate total amount - use unitCost if totalAmount is NaN or invalid
      // Only calculate if we don't have a PO total amount
      if (receipt.totalAmount === "0" || parseFloat(receipt.totalAmount) === 0) {
        let itemTotal = 0;
        // Handle totalAmount as number or string
        if (item.totalAmount != null && item.totalAmount !== undefined) {
          const parsedTotal = typeof item.totalAmount === 'number' ? item.totalAmount : parseFloat(String(item.totalAmount));
          if (!isNaN(parsedTotal) && parsedTotal > 0) {
            itemTotal = parsedTotal;
          }
        }
        // Fallback: calculate from unitCost * quantity if totalAmount is 0 or invalid
        if (itemTotal === 0 && item.unitCost != null && item.quantityReceived) {
          const unitCost = typeof item.unitCost === 'number' ? item.unitCost : parseFloat(String(item.unitCost || "0"));
          const quantity = typeof item.quantityReceived === 'number' ? item.quantityReceived : parseFloat(String(item.quantityReceived || "0"));
          if (!isNaN(unitCost) && !isNaN(quantity) && unitCost > 0 && quantity > 0) {
            itemTotal = unitCost * quantity;
          }
        }
        const currentTotal = parseFloat(receipt.totalAmount || "0");
        receipt.totalAmount = (currentTotal + itemTotal).toFixed(2);
      }
    });
    
    return Array.from(grouped.values());
  }, [goodsReceiptsRaw]);

  const {
    data: selectedGoodsReceiptDetails,
    isFetching: goodsReceiptDetailsLoading,
    error: goodsReceiptDetailsError,
  } = useQuery<GoodsReceiptDetail | null>({
    queryKey: ["/api/inventory/goods-receipts", selectedGoodsReceiptId],
    enabled: Boolean(selectedGoodsReceiptId) && showGoodsReceiptDetails,
    queryFn: async ({ queryKey }) => {
      try {
        const [, receiptId] = queryKey;
        if (!receiptId) {
          throw new Error("Receipt ID is required");
        }
        const response = await apiRequest(
          "GET",
          `/api/inventory/goods-receipts/${receiptId}`,
        );
        if (!response.ok) {
          let errorMessage = `Failed to fetch goods receipt: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // If JSON parsing fails, use default message
          }
          throw new Error(errorMessage);
        }
        const data = await response.json();
        
        // Transform the data to match the expected interface
        const transformedData: GoodsReceiptDetail = {
          id: data.id,
          receiptNumber: data.receiptNumber || `GR-${data.id}`,
          purchaseOrderId: data.purchaseOrderId || undefined,
          poNumber: data.poNumber || null,
          supplierName: data.supplierName || null,
          receivedDate: data.receivedDate || data.createdAt || new Date().toISOString(),
          totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : parseFloat(data.totalAmount || '0'),
          notes: data.notes || null,
          items: Array.isArray(data.items) ? data.items.map((item: any) => ({
            itemId: item.itemId,
            itemName: item.itemName || 'Unknown Item',
            quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity || '0'),
            unitPrice: typeof item.unitPrice === 'string' ? item.unitPrice : String(item.unitPrice || '0'),
          })) : [],
          purchaseOrder: data.purchaseOrder || null,
          purchaseOrderItems: Array.isArray(data.purchaseOrderItems) ? data.purchaseOrderItems.map((item: any) => ({
            id: item.id || 0,
            itemId: item.itemId || 0,
            itemName: item.itemName || null,
            quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity || '0'),
            unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice || '0'),
            totalPrice: typeof item.totalPrice === 'number' ? item.totalPrice : parseFloat(item.totalPrice || '0'),
            receivedQuantity: typeof item.receivedQuantity === 'number' ? item.receivedQuantity : parseFloat(item.receivedQuantity || '0'),
          })) : [],
        };
        
        return transformedData;
      } catch (error) {
        console.error("Error fetching goods receipt details:", error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000,
  });

  // 5. Alerts Data (Low Stock & Expiry)
  const { data: alerts = [] } = useQuery<StockAlert[]>({
    queryKey: ["/api/inventory/alerts"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/alerts");
      return response.json();
    },
    retry: 3,
  });

  // View Purchase Order function
  const viewPurchaseOrder = (po: PurchaseOrder) => {
    console.log("Viewing purchase order:", po);
    setSelectedPO(po);
    setShowPODetailsDialog(true);
  };

  const openGoodsReceiptDetails = (receiptId: number) => {
    setSelectedGoodsReceiptId(receiptId);
    setShowGoodsReceiptDetails(true);
  };

  const closeGoodsReceiptDetails = () => {
    setShowGoodsReceiptDetails(false);
    setSelectedGoodsReceiptId(null);
  };

  // Delete goods receipt mutation
  const deleteGoodsReceiptMutation = useMutation({
    mutationFn: async (receiptId: number) => {
      const response = await apiRequest(
        "DELETE",
        `/api/inventory/goods-receipts/${receiptId}`,
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to delete goods receipt" }));
        throw new Error(errorData.error || "Failed to delete goods receipt");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowDeleteGoodsReceiptSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/goods-receipts"] });
    },
    onError: (error: any) => {
      console.error("Error deleting goods receipt:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete goods receipt",
        variant: "destructive",
      });
    },
  });

  const handleDeleteGoodsReceipt = (receiptId: number) => {
    setGoodsReceiptToDelete(receiptId);
    setShowDeleteGoodsReceiptModal(true);
  };

  const handleViewGoodsReceiptPdfById = async (receiptId: number) => {
    try {
      setPdfLoading(true);
      setShowPdfViewer(true);
      
      // First, check if PDF exists
      const checkResponse = await apiRequest('GET', `/api/inventory/goods-receipts/${receiptId}/pdf/check`);
      if (!checkResponse.ok) {
        throw new Error(`Failed to check PDF: ${checkResponse.status}`);
      }
      
      const checkData = await checkResponse.json();
      
      // If PDF doesn't exist, generate it
      if (!checkData.exists) {
        toast({
          title: "Generating PDF",
          description: "PDF not found. Generating now...",
        });
        
        const generateResponse = await apiRequest('POST', `/api/inventory/goods-receipts/${receiptId}/pdf/generate`);
        if (!generateResponse.ok) {
          throw new Error(`Failed to generate PDF: ${generateResponse.status}`);
        }
      }
      
      // Fetch PDF with authentication
      const response = await apiRequest('GET', `/api/inventory/goods-receipts/${receiptId}/pdf`);
      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.status}`);
      }
      
      // Create blob URL from response
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPdfUrl(blobUrl);
      setPdfLoading(false);
    } catch (error: any) {
      console.error("Error loading PDF:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load PDF",
        variant: "destructive",
      });
      setPdfLoading(false);
      setShowPdfViewer(false);
    }
  };

  const handleViewGoodsReceiptPdf = async (receipt: GoodsReceipt) => {
    setSelectedReceiptForPdf(receipt);
    await handleViewGoodsReceiptPdfById(receipt.id);
  };

  const confirmDeleteGoodsReceipt = () => {
    if (goodsReceiptToDelete !== null) {
      deleteGoodsReceiptMutation.mutate(goodsReceiptToDelete);
      setShowDeleteGoodsReceiptModal(false);
      setGoodsReceiptToDelete(null);
    }
  };

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      console.log("Starting deletion API call for ID:", itemId);
      const response = await apiRequest(
        "DELETE",
        `/api/inventory/items/${itemId}`,
      );
      console.log("Delete API response:", response);
      return response;
    },
    onSuccess: (data, variables) => {
      console.log("Delete mutation onSuccess called for ID:", variables);
      setSuccessMessage("Inventory item has been deleted successfully.");
      setShowSuccessModal(true);
      // Force cache invalidation with refetch
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      queryClient.refetchQueries({ queryKey: ["/api/inventory/items"] });
      console.log("Cache invalidated and refetch triggered");
    },
    onError: (error: any) => {
      console.log("Delete mutation onError called:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete inventory item",
        variant: "destructive",
      });
    },
  });

  // Delete item function with confirmation modal
  const deleteItem = (item: InventoryItem) => {
    console.log("Delete item clicked for:", item.name, "ID:", item.id);
    // Add a small delay to ensure the dropdown closes properly
    setTimeout(() => {
      setItemToDelete(item);
      setShowDeleteConfirmModal(true);
    }, 100);
  };

  // Confirm delete action
  const confirmDeleteItem = () => {
    if (itemToDelete) {
      console.log("Calling deleteItemMutation.mutate with ID:", itemToDelete.id);
      deleteItemMutation.mutate(itemToDelete.id);
      setShowDeleteConfirmModal(false);
      setItemToDelete(null);
    }
  };

  // Generate Item Report function
  const generateItemReport = (item: InventoryItem) => {
    const reportData = {
      reportDate: new Date().toLocaleDateString(),
      reportTime: new Date().toLocaleTimeString(),
      item: {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.categoryName || "Uncategorized",
        description: item.description || "No description available",
        barcode: item.barcode || "N/A",
        unitOfMeasurement: item.unitOfMeasurement,
        brandName: item.brandName || "N/A",
        manufacturer: item.manufacturer || "N/A",
        prescriptionRequired: item.prescriptionRequired ? "Yes" : "No",
        isActive: item.isActive ? "Active" : "Inactive",
      },
      pricing: {
        purchasePrice: parseFloat(item.purchasePrice).toFixed(2),
        salePrice: parseFloat(item.salePrice).toFixed(2),
        mrp: item.mrp ? parseFloat(item.mrp).toFixed(2) : "N/A",
        stockValue: parseFloat(item.stockValue.toString()).toFixed(2),
      },
      inventory: {
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        reorderPoint: item.reorderPoint,
        stockStatus: item.isLowStock ? "Low Stock" : "In Stock",
        expiryDate: item.expiryDate
          ? format(new Date(item.expiryDate), "MMM dd, yyyy")
          : "No expiry date",
        isExpired: item.expiryDate
          ? new Date(item.expiryDate) < new Date()
          : false,
      },
      timestamps: {
        created: format(new Date(item.createdAt), "MMM dd, yyyy HH:mm"),
        lastUpdated: format(new Date(item.updatedAt), "MMM dd, yyyy HH:mm"),
      },
    };

    // Generate CSV content
    const csvContent = [
      "CURA EMR - INVENTORY ITEM REPORT",
      `Generated: ${reportData.reportDate} at ${reportData.reportTime}`,
      "",
      "BASIC INFORMATION",
      `Item ID,${reportData.item.id}`,
      `SKU,${reportData.item.sku}`,
      `Name,${reportData.item.name}`,
      `Category,${reportData.item.category}`,
      `Description,${reportData.item.description}`,
      `Barcode,${reportData.item.barcode}`,
      `Unit of Measurement,${reportData.item.unitOfMeasurement}`,
      `Brand,${reportData.item.brandName}`,
      `Manufacturer,${reportData.item.manufacturer}`,
      `Prescription Required,${reportData.item.prescriptionRequired}`,
      `Status,${reportData.item.isActive}`,
      "",
      "PRICING INFORMATION",
      `Purchase Price (£),${reportData.pricing.purchasePrice}`,
      `Sale Price (£),${reportData.pricing.salePrice}`,
      `MRP (£),${reportData.pricing.mrp}`,
      `Total Stock Value (£),${reportData.pricing.stockValue}`,
      "",
      "INVENTORY MANAGEMENT",
      `Current Stock,${reportData.inventory.currentStock}`,
      `Minimum Stock Level,${reportData.inventory.minimumStock}`,
      `Reorder Point,${reportData.inventory.reorderPoint}`,
      `Stock Status,${reportData.inventory.stockStatus}`,
      `Expiry Date,${reportData.inventory.expiryDate}`,
      `Expired Status,${reportData.inventory.isExpired ? "EXPIRED" : "Valid"}`,
      "",
      "RECORD INFORMATION",
      `Created,${reportData.timestamps.created}`,
      `Last Updated,${reportData.timestamps.lastUpdated}`,
      "",
      "Report generated by Cura EMR System",
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `inventory-report-${item.sku}-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccessMessage(`Inventory report for ${item.name} has been downloaded as CSV file.`);
    setShowSuccessModal(true);
  };

  const { data: categories = [], error: categoriesError } = useQuery<
    InventoryCategory[]
  >({
    queryKey: ["/api/inventory/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/categories");
      return response.json();
    },
    retry: 3,
  });

  const { data: inventoryValue } = useQuery<InventoryValue>({
    queryKey: ["/api/inventory/reports/value"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/reports/value");
      return response.json();
    },
    retry: 3,
  });

  const { data: lowStockItems = [] } = useQuery<LowStockItem[]>({
    queryKey: ["/api/inventory/reports/low-stock"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory/reports/low-stock");
      return response.json();
    },
    retry: 3,
  });

  // Send purchase order email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async ({
      purchaseOrderId,
      email,
    }: {
      purchaseOrderId: number;
      email: string;
    }) => {
      await apiRequest(
        "POST",
        `/api/inventory/purchase-orders/${purchaseOrderId}/send-email`,
        { email },
      );
    },
    onSuccess: () => {
      setSuccessMessage("Purchase order has been sent successfully.");
      setShowSuccessModal(true);
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/purchase-orders"],
      });
      setShowEmailDialog(false);
      setEmailAddress("");
      setSelectedPOForEmail(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send purchase order email",
        variant: "destructive",
      });
    },
  });

  // Handle send email button click
  const handleSendEmail = (po: PurchaseOrder) => {
    setSelectedPOForEmail(po);
    setEmailAddress(po.supplierEmail || "");
    setShowEmailDialog(true);
  };

  // Confirm and send email
  const confirmSendEmail = () => {
    if (!selectedPOForEmail || !emailAddress.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    sendEmailMutation.mutate({
      purchaseOrderId: selectedPOForEmail.id,
      email: emailAddress.trim(),
    });
  };

  // Delete purchase order mutation
  const deletePurchaseOrderMutation = useMutation({
    mutationFn: async (purchaseOrderId: number) => {
      await apiRequest(
        "DELETE",
        `/api/inventory/purchase-orders/${purchaseOrderId}`,
      );
    },
    onSuccess: () => {
      setSuccessMessage("Purchase order has been deleted successfully.");
      setShowSuccessModal(true);
      queryClient.invalidateQueries({
        queryKey: ["/api/inventory/purchase-orders"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete purchase order",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      pending: "outline",
      sent: "secondary",
      received: "default",
      cancelled: "destructive",
      ordered: "secondary",
      delivered: "default",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getAlertTypeBadge = (alertType: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      low_stock: "destructive",
      expired: "destructive",
      expiring_soon: "outline",
    };
    return (
      <Badge variant={variants[alertType] || "outline"}>
        {alertType.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  // Filter items based on search and filters
  const filteredItems = items.filter((item) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (
        !item.name.toLowerCase().includes(searchLower) &&
        !item.sku.toLowerCase().includes(searchLower) &&
        !item.barcode?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Category filter - only apply if a category is selected (not "All Categories")
    if (selectedCategory !== undefined && selectedCategory !== null) {
      // Find the selected category name from categories array
      const selectedCategoryData = categories.find(cat => cat.id === selectedCategory);
      const selectedCategoryName = selectedCategoryData?.name;
      
      if (selectedCategoryName) {
        // Match by categoryName (case-insensitive)
        const itemCategoryName = (item.categoryName || '').toLowerCase().trim();
        const matchCategoryName = selectedCategoryName.toLowerCase().trim();
        
        if (itemCategoryName !== matchCategoryName) {
          return false;
        }
      } else {
        // Fallback: try to match by categoryId if category name not found
        const itemCategoryId = item.categoryId !== undefined ? Number(item.categoryId) : null;
        if (itemCategoryId === null || itemCategoryId !== Number(selectedCategory)) {
          return false;
        }
      }
    }

    // Low stock filter
    if (showLowStock && !item.isLowStock) {
      return false;
    }

    return true;
  });

  // Filter stock entries
  const filteredStockEntries = stockEntries.filter((entry) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      if (
        !entry.itemName.toLowerCase().includes(searchLower) &&
        !entry.batchNumber.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-full-width page-zoom-90">
      <Header title="Comprehensive Inventory Management" subtitle="Complete healthcare inventory system with Item Master, Stock Tracking, Purchase Orders, Goods Receipt & Alerts" />
      
      <div className="w-full px-3 sm:px-4 lg:px-5 py-4">
        <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mb-4">
              {canCreate('inventory') && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
              {canCreate('inventory') && (
                <Button variant="outline" onClick={() => setShowPODialog(true)}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  New Purchase Order
                </Button>
              )}
              {canCreate('inventory') && (
                <Button
                  variant="outline"
                  onClick={() => setShowReceiptDialog(true)}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Goods Receipt
                </Button>
              )}
        </div>

        {/* Critical Alerts Banner */}
        {alerts.length > 0 && (
          <div className="mb-6">
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="text-orange-800 dark:text-orange-200 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Critical Inventory Alerts ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {getAlertTypeBadge(alert.alertType)}
                        <span className="font-medium">{alert.itemName}</span>
                        <span className="text-sm text-gray-600">
                          {alert.message}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(new Date(alert.createdAt), "MMM dd, HH:mm")}
                      </span>
                    </div>
                  ))}
                  {alerts.length > 3 && (
                    <p className="text-sm text-gray-600 text-center pt-2">
                      +{alerts.length - 3} more alerts - View all in Alerts tab
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                £
                {inventoryValue?.totalValue
                  ? parseFloat(inventoryValue.totalValue).toFixed(2)
                  : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {inventoryValue?.totalItems || 0} items
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inventoryValue?.totalStock?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground">Units in stock</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Low Stock Items
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {lowStockItems.length || inventoryValue?.lowStockItems || 0}
              </div>
              <p className="text-xs text-muted-foreground">Need restocking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Expiring Soon
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {inventoryValue?.expiringItems || 0}
              </div>
              <p className="text-xs text-muted-foreground">Within 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Expired Items
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {inventoryValue?.expiredItems || 0}
              </div>
              <p className="text-xs text-muted-foreground">Remove from stock</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger
              value="item-master"
              className="flex items-center space-x-2"
            >
              <Package className="h-4 w-4" />
              <span>Item Master</span>
            </TabsTrigger>
            <TabsTrigger
              value="stock-inventory"
              className="flex items-center space-x-2"
            >
              <Archive className="h-4 w-4" />
              <span>Stock/Inventory</span>
            </TabsTrigger>
            <TabsTrigger
              value="purchase-orders"
              className="flex items-center space-x-2"
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Purchase Orders</span>
            </TabsTrigger>
            <TabsTrigger
              value="goods-receipt"
              className="flex items-center space-x-2"
            >
              <Truck className="h-4 w-4" />
              <span>Goods Receipt</span>
            </TabsTrigger>
            <TabsTrigger
              value="sales"
              className="flex items-center space-x-2"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Sales</span>
            </TabsTrigger>
            <TabsTrigger
              value="returns"
              className="flex items-center space-x-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Returns</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Alerts</span>
            </TabsTrigger>
          </TabsList>

          {/* 1. Item Master Tab */}
          <TabsContent value="item-master" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Item Master - Complete Item Database
                </CardTitle>
                <CardDescription>
                  Manage item details including ID, Name & Category, Unit of
                  Measurement, Expiry Date, and Reorder Level
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name, SKU, or barcode..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={selectedCategory !== undefined ? selectedCategory.toString() : "all"}
                    onValueChange={(value) => {
                      if (value === "all") {
                        setSelectedCategory(undefined);
                      } else {
                        const categoryId = parseInt(value, 10);
                        if (!isNaN(categoryId)) {
                          setSelectedCategory(categoryId);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id.toString()}
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => setShowLowStock(!showLowStock)}
                    className={
                      showLowStock ? "bg-orange-100 text-orange-800" : ""
                    }
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Low Stock Only
                  </Button>
                </div>

                {/* Items Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item ID</TableHead>
                        <TableHead>Item Name & Category</TableHead>
                        <TableHead>Unit of Measurement</TableHead>
                        <TableHead>Current Stock</TableHead>
                        <TableHead>Reorder Level</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <div className="flex items-center justify-center">
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              Loading items...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center py-8 text-gray-500"
                          >
                            No items found matching your criteria
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              #{index + 1}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-gray-500">
                                  {item.categoryName || "Uncategorized"}
                                </div>
                                <div className="text-xs text-gray-400">
                                  SKU: {item.sku}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{item.unitOfMeasurement}</TableCell>
                            <TableCell>
                              <div
                                className={`font-medium ${item.isLowStock ? "text-orange-600" : ""}`}
                              >
                                {item.currentStock}
                                {item.isLowStock && (
                                  <AlertTriangle className="h-3 w-3 inline ml-1 text-orange-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{item.reorderPoint}</TableCell>
                            <TableCell>
                              {item.expiryDate ? (
                                <span
                                  className={
                                    new Date(item.expiryDate) < new Date()
                                      ? "text-red-600"
                                      : ""
                                  }
                                >
                                  {format(
                                    new Date(item.expiryDate),
                                    "MMM dd, yyyy",
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-400">No expiry</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.isLowStock ? (
                                <Badge variant="destructive">Low Stock</Badge>
                              ) : (
                                <Badge variant="default">In Stock</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedItem(item);
                                      setShowItemDetailsDialog(true);
                                    }}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => generateItemReport(item)}
                                  >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Generate Report
                                  </DropdownMenuItem>
                                  {(canDelete('inventory') || isAdmin() || isDoctor() || isNurse()) && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          deleteItem(item);
                                        }}
                                        className="text-red-600 focus:text-red-600 hover:text-red-700 hover:bg-red-50"
                                        disabled={deleteItemMutation.isPending}
                                      >
                                        {deleteItemMutation.isPending ? (
                                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="mr-2 h-4 w-4" />
                                        )}
                                        {deleteItemMutation.isPending
                                          ? "Deleting..."
                                          : "Delete Item"}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. Stock/Inventory Tab */}
          <TabsContent value="stock-inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Archive className="h-5 w-5 mr-2" />
                  Stock/Inventory Table - Batch & Location Tracking
                </CardTitle>
                <CardDescription>
                  Track stock by batch number, location/department, expiry dates
                  for complete traceability
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Stock Search */}
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by item name or batch number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Stock Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item ID & Name</TableHead>
                        <TableHead>Batch Number</TableHead>
                        <TableHead>Quantity Available</TableHead>
                        <TableHead>Location/Department</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="flex items-center justify-center">
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              Loading stock entries...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredStockEntries.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-gray-500"
                          >
                            No stock entries found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStockEntries.map((entry, index) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  #{index + 1} - {entry.itemName}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {entry.batchNumber}
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.quantityAvailable}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                                {entry.location}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  entry.isExpired
                                    ? "text-red-600 font-medium"
                                    : new Date(entry.expiryDate) <=
                                        new Date(
                                          Date.now() + 30 * 24 * 60 * 60 * 1000,
                                        )
                                      ? "text-yellow-600"
                                      : ""
                                }
                              >
                                {format(
                                  new Date(entry.expiryDate),
                                  "MMM dd, yyyy",
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              {entry.supplierName || "Unknown"}
                            </TableCell>
                            <TableCell>
                              {entry.isExpired ? (
                                <Badge variant="destructive">Expired</Badge>
                              ) : new Date(entry.expiryDate) <=
                                new Date(
                                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                                ) ? (
                                <Badge
                                  variant="outline"
                                  className="text-yellow-600 border-yellow-600"
                                >
                                  Expiring Soon
                                </Badge>
                              ) : (
                                <Badge variant="default">Valid</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. Purchase Orders Tab */}
          <TabsContent value="purchase-orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Purchase Orders (POs) - Supplier & Order Management
                </CardTitle>
                <CardDescription>
                  Manage PO Numbers, Supplier IDs, Order Status, and Items
                  Ordered with quantities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Supplier ID & Name</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Items Ordered</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <div className="flex items-center justify-center">
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              Loading purchase orders...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : purchaseOrders.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center py-8 text-gray-500"
                          >
                            No purchase orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchaseOrders.map((po) => {
                          const totalQuantity = po.itemsOrdered?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                          return (
                          <TableRow key={po.id}>
                            <TableCell className="font-mono font-medium">
                              {po.poNumber}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  #{po.supplierId} - {po.supplierName}
                                </div>
                                {po.supplierEmail && (
                                  <div className="text-sm text-gray-500">
                                    {po.supplierEmail}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(po.orderDate), "MMM dd, yyyy")}
                            </TableCell>
                            <TableCell>{getStatusBadge(po.status)}</TableCell>
                            <TableCell className="font-medium">
                              £{parseFloat(po.totalAmount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {po.itemsOrdered?.length || 0} items
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">
                                {totalQuantity}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => viewPurchaseOrder(po)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSendEmail(po)}
                                  disabled={sendEmailMutation.isPending}
                                  variant={po.emailSent ? "outline" : "default"}
                                >
                                  {po.emailSent ? "Resend" : "Send"}
                                </Button>
                                {canDelete('inventory') && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      deletePurchaseOrderMutation.mutate(po.id)
                                    }
                                    disabled={
                                      deletePurchaseOrderMutation.isPending
                                    }
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4. Goods Receipt Tab */}
          <TabsContent value="goods-receipt" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Truck className="h-5 w-5 mr-2" />
                  Goods Receipt - Delivery & Batch Recording
                </CardTitle>
                <CardDescription>
                  Record Receipt Numbers, Items Received with batch/expiry
                  information, and Supplier Names
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="py-2 px-3 text-xs font-semibold">Receipt Number</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-semibold">PO Number</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-semibold">Supplier Name</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-semibold">Received Date</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-semibold">Items Received</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-semibold">Total Amount</TableHead>
                        <TableHead className="py-2 px-3 text-xs font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receiptLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="flex items-center justify-center">
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              Loading goods receipts...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : goodsReceipts.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-gray-500"
                          >
                            No goods receipts found
                          </TableCell>
                        </TableRow>
                      ) : (
                        goodsReceipts.map((receipt) => (
                          <TableRow key={receipt.id}>
                            <TableCell className="font-mono font-medium">
                              {receipt.receiptNumber}
                            </TableCell>
                            <TableCell className="font-mono">
                              {receipt.poNumber ||
                                (receipt.purchaseOrderId
                                  ? `PO-${receipt.purchaseOrderId}`
                                  : "N/A")}
                            </TableCell>
                            <TableCell className="font-medium">
                              {receipt.supplierName}
                            </TableCell>
                            <TableCell>
                              {format(
                                new Date(receipt.receivedDate),
                                "MMM dd, yyyy",
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {receipt.itemsReceived?.length || 0} items
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              £{parseFloat(receipt.totalAmount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openGoodsReceiptDetails(receipt.id)}
                                  title="View Details"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewGoodsReceiptPdf(receipt)}
                                  title="View PDF"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <FileText className="h-3 w-3" />
                                </Button>
                                {canDelete('inventory') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteGoodsReceipt(receipt.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <Dialog
            open={showGoodsReceiptDetails}
            onOpenChange={(open) => {
              if (!open) {
                closeGoodsReceiptDetails();
              }
            }}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Goods Receipt Details</DialogTitle>
                <DialogDescription>
                  Review the source purchase order and received items for this
                  goods receipt.
                </DialogDescription>
              </DialogHeader>
              {goodsReceiptDetailsLoading ? (
                <div className="flex items-center justify-center py-6 space-x-2 text-sm text-gray-500">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading receipt...
                </div>
              ) : selectedGoodsReceiptDetails ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Receipt #
                      </p>
                      <p className="font-mono font-semibold">
                        {selectedGoodsReceiptDetails.receiptNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Received Date
                      </p>
                      <p className="font-medium">
                        {format(
                          new Date(selectedGoodsReceiptDetails.receivedDate),
                          "PPP"
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Purchase Order
                      </p>
                      <p className="font-medium">
                        {selectedGoodsReceiptDetails.purchaseOrder?.poNumber ||
                          selectedGoodsReceiptDetails.poNumber ||
                          (selectedGoodsReceiptDetails.purchaseOrderId
                            ? `PO-${selectedGoodsReceiptDetails.purchaseOrderId}`
                            : "N/A")}
                      </p>
                      {selectedGoodsReceiptDetails.purchaseOrder?.status && (
                        <p className="text-xs text-gray-500 mt-1">
                          Status: <span className="capitalize">{selectedGoodsReceiptDetails.purchaseOrder.status}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Supplier
                      </p>
                      <p className="font-medium">
                        {selectedGoodsReceiptDetails.supplierName || "Unknown"}
                      </p>
                    </div>
                  </div>

                  {/* Purchase Order Details Section */}
                  {selectedGoodsReceiptDetails.purchaseOrder && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Purchase Order Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            PO Number
                          </p>
                          <p className="font-medium">
                            {selectedGoodsReceiptDetails.purchaseOrder.poNumber}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Order Date
                          </p>
                          <p className="font-medium">
                            {selectedGoodsReceiptDetails.purchaseOrder.orderDate
                              ? format(
                                  new Date(selectedGoodsReceiptDetails.purchaseOrder.orderDate),
                                  "PPP"
                                )
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Expected Delivery
                          </p>
                          <p className="font-medium">
                            {selectedGoodsReceiptDetails.purchaseOrder.expectedDeliveryDate
                              ? format(
                                  new Date(selectedGoodsReceiptDetails.purchaseOrder.expectedDeliveryDate),
                                  "PPP"
                                )
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Status
                          </p>
                          <p className="font-medium capitalize">
                            {selectedGoodsReceiptDetails.purchaseOrder.status || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Total Amount
                          </p>
                          <p className="font-semibold text-emerald-600">
                            £{typeof selectedGoodsReceiptDetails.purchaseOrder.totalAmount === 'number'
                              ? selectedGoodsReceiptDetails.purchaseOrder.totalAmount.toFixed(2)
                              : parseFloat(String(selectedGoodsReceiptDetails.purchaseOrder.totalAmount || '0')).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Tax Amount
                          </p>
                          <p className="font-medium">
                            £{typeof selectedGoodsReceiptDetails.purchaseOrder.taxAmount === 'number'
                              ? selectedGoodsReceiptDetails.purchaseOrder.taxAmount.toFixed(2)
                              : parseFloat(String(selectedGoodsReceiptDetails.purchaseOrder.taxAmount || '0')).toFixed(2)}
                          </p>
                        </div>
                        {selectedGoodsReceiptDetails.purchaseOrder.supplierName && (
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Supplier
                            </p>
                            <p className="font-medium">
                              {selectedGoodsReceiptDetails.purchaseOrder.supplierName}
                            </p>
                          </div>
                        )}
                        {selectedGoodsReceiptDetails.purchaseOrder.supplierEmail && (
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Supplier Email
                            </p>
                            <p className="font-medium text-sm">
                              {selectedGoodsReceiptDetails.purchaseOrder.supplierEmail}
                            </p>
                          </div>
                        )}
                      </div>
                      {selectedGoodsReceiptDetails.purchaseOrder.notes && (
                        <div className="mt-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Notes
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedGoodsReceiptDetails.purchaseOrder.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Notes
                      </p>
                      <p className="text-sm text-gray-600">
                        {selectedGoodsReceiptDetails.notes || "No notes provided."}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Total Amount
                      </p>
                      <p className="text-base font-semibold text-emerald-600">
                        £{selectedGoodsReceiptDetails.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                      Items from Purchase Order
                    </p>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead className="text-right">
                              Unit Price
                            </TableHead>
                            <TableHead className="text-right">
                              Line Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            // Use purchaseOrderItems if available, otherwise fall back to items
                            const displayItems = selectedGoodsReceiptDetails.purchaseOrderItems && selectedGoodsReceiptDetails.purchaseOrderItems.length > 0
                              ? selectedGoodsReceiptDetails.purchaseOrderItems
                              : selectedGoodsReceiptDetails.items;

                            if (!displayItems || displayItems.length === 0) {
                              return (
                                <TableRow>
                                  <TableCell
                                    colSpan={4}
                                    className="text-center py-4 text-sm text-gray-500"
                                  >
                                    No ordered items found for this receipt.
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            return displayItems.map((item: any, index: number) => (
                              <TableRow key={`${item.itemId || item.id || index}-${item.quantity}`}>
                                <TableCell>{item.itemName || 'Unknown Item'}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                  £{typeof item.unitPrice === 'number' 
                                    ? item.unitPrice.toFixed(2) 
                                    : parseFloat(item.unitPrice || "0").toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  £{typeof item.totalPrice === 'number'
                                    ? item.totalPrice.toFixed(2)
                                    : (item.quantity * (typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice || "0"))).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ));
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : goodsReceiptDetailsError ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-sm text-red-600 font-medium">
                    Error loading goods receipt details
                  </p>
                  <p className="text-xs text-gray-500 break-words">
                    {goodsReceiptDetailsError instanceof Error 
                      ? goodsReceiptDetailsError.message 
                      : String(goodsReceiptDetailsError) || "An unexpected error occurred"}
                  </p>
                </div>
              ) : (
                <p className="text-center py-6 text-sm text-gray-500">
                  Unable to load goods receipt details.
                </p>
              )}
            </DialogContent>
          </Dialog>

          {/* 5. Sales Tab */}
          <TabsContent value="sales" className="space-y-6">
            <PharmacySales />
          </TabsContent>

          {/* 6. Returns Tab */}
          <TabsContent value="returns" className="space-y-6">
            <ReturnsManagement />
          </TabsContent>

          {/* 7. Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Critical Alerts - Low Stock & Expiry Monitoring
                </CardTitle>
                <CardDescription>
                  Monitor Low Stock alerts based on reorder levels and Expiry
                  Alerts for patient safety
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p className="text-lg font-medium">No Critical Alerts</p>
                      <p className="text-sm">
                        All inventory levels and expiry dates are within safe
                        limits
                      </p>
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <Card
                        key={alert.id}
                        className={`${
                          alert.alertType === "expired" ||
                          alert.alertType === "low_stock"
                            ? "border-red-200 bg-red-50 dark:bg-red-950"
                            : "border-yellow-200 bg-yellow-50 dark:bg-yellow-950"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <AlertTriangle
                                className={`h-5 w-5 ${
                                  alert.alertType === "expired" ||
                                  alert.alertType === "low_stock"
                                    ? "text-red-500"
                                    : "text-yellow-500"
                                }`}
                              />
                              {getAlertTypeBadge(alert.alertType)}
                              <div>
                                <div className="font-medium">
                                  {alert.itemName}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {alert.message}
                                </div>
                                {alert.batchNumber && (
                                  <div className="text-xs text-gray-500">
                                    Batch: {alert.batchNumber}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-gray-500">
                                {format(
                                  new Date(alert.createdAt),
                                  "MMM dd, HH:mm",
                                )}
                              </div>
                              {alert.currentStock !== undefined && (
                                <div className="text-xs">
                                  Stock: {alert.currentStock}/
                                  {alert.minimumStock}
                                </div>
                              )}
                              {alert.expiryDate && (
                                <div className="text-xs">
                                  Expires:{" "}
                                  {format(
                                    new Date(alert.expiryDate),
                                    "MMM dd, yyyy",
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        {showAddDialog && (
          <AddItemDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
        )}

        {showStockDialog && selectedItem && (
          <StockAdjustmentDialog
            open={showStockDialog}
            onOpenChange={(open) => {
              setShowStockDialog(open);
              if (!open) {
                // Refresh the selected item when dialog closes
                queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
                queryClient.invalidateQueries({ queryKey: [`/api/inventory/items/${selectedItem.id}`] });
              }
            }}
            item={selectedItem}
          />
        )}

        {showPODialog && (
          <PurchaseOrderDialog
            open={showPODialog}
            onOpenChange={(open) => {
              setShowPODialog(open);
              if (!open) {
                // Clear selected PO when PO dialog closes
                setSelectedPurchaseOrderIdForReceipt(undefined);
              }
            }}
            items={items}
            onPurchaseOrderCreated={(purchaseOrderId) => {
              // Set the selected PO ID and open Goods Receipt dialog
              setSelectedPurchaseOrderIdForReceipt(purchaseOrderId);
              setShowReceiptDialog(true);
            }}
          />
        )}

        {showReceiptDialog && (
          <GoodsReceiptDialog
            open={showReceiptDialog}
            onOpenChange={(open) => {
              setShowReceiptDialog(open);
              if (!open) {
                // Clear selected PO when Goods Receipt dialog closes
                setSelectedPurchaseOrderIdForReceipt(undefined);
              }
            }}
            items={items}
            defaultPurchaseOrderId={selectedPurchaseOrderIdForReceipt}
            onReceiptCreated={async (receiptId) => {
              // Show PDF popup after receipt creation
              await handleViewGoodsReceiptPdfById(receiptId);
            }}
          />
        )}

        {showPODetailsDialog && selectedPO && (
          <Dialog
            open={showPODetailsDialog}
            onOpenChange={setShowPODetailsDialog}
          >
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Purchase Order Details - {selectedPO.poNumber}
                </DialogTitle>
                <DialogDescription>
                  Complete purchase order information and supplier details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Header Information */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      PO Number
                    </Label>
                    <div className="font-mono font-semibold">
                      {selectedPO.poNumber}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Status
                    </Label>
                    <div className="mt-1">
                      {getStatusBadge(selectedPO.status)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Order Date
                    </Label>
                    <div>
                      {format(new Date(selectedPO.orderDate), "MMM dd, yyyy")}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Expected Delivery
                    </Label>
                    <div>
                      {selectedPO.expectedDeliveryDate
                        ? format(
                            new Date(selectedPO.expectedDeliveryDate),
                            "MMM dd, yyyy",
                          )
                        : "Not specified"}
                    </div>
                  </div>
                </div>

                {/* Supplier Information */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Building2 className="h-4 w-4 mr-2" />
                    Supplier Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Supplier ID
                      </Label>
                      <div>#{selectedPO.supplierId}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Supplier Name
                      </Label>
                      <div className="font-medium">
                        {selectedPO.supplierName}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Email Address
                      </Label>
                      <div className="font-mono text-sm">
                        {selectedPO.supplierEmail || "Not provided"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Information */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Financial Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Total Amount
                      </Label>
                      <div className="text-lg font-bold text-green-600">
                        £{parseFloat(selectedPO.totalAmount).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Tax Amount
                      </Label>
                      <div className="font-medium">
                        £{parseFloat(selectedPO.taxAmount || "0").toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Items Count
                      </Label>
                      <div className="font-medium">
                        {selectedPO.itemsOrdered?.length || 0} items
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Email Status
                      </Label>
                      <div className="font-medium">
                        {selectedPO.emailSent ? (
                          <Badge variant="default" className="text-white">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes if any */}
                {selectedPO.notes && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {selectedPO.notes}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      handleSendEmail(selectedPO);
                      setShowPODetailsDialog(false);
                    }}
                    disabled={sendEmailMutation.isPending}
                    className="flex items-center"
                    variant={selectedPO.emailSent ? "outline" : "default"}
                  >
                    {sendEmailMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    {selectedPO.emailSent
                      ? "Resend to Supplier"
                      : "Send to Supplier"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPODetailsDialog(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Item Details Dialog */}
        {showItemDetailsDialog && selectedItem && (
          <Dialog
            open={showItemDetailsDialog}
            onOpenChange={setShowItemDetailsDialog}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Item Details - {selectedItem.name}
                </DialogTitle>
                <DialogDescription>
                  Complete information about {selectedItem.name} including
                  inventory, pricing, and status details
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Item ID
                          </Label>
                          <p className="font-mono text-sm">{selectedItem.id}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            SKU
                          </Label>
                          <p className="font-mono text-sm">
                            {selectedItem.sku}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Name
                          </Label>
                          <p className="font-medium">{selectedItem.name}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Category
                          </Label>
                          <p>{selectedItem.categoryName || "Uncategorized"}</p>
                        </div>
                        {selectedItem.description && (
                          <div className="col-span-2">
                            <Label className="text-sm font-medium text-gray-600">
                              Description
                            </Label>
                            <p className="text-sm">
                              {selectedItem.description}
                            </p>
                          </div>
                        )}
                        {selectedItem.barcode && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">
                              Barcode
                            </Label>
                            <p className="font-mono text-sm">
                              {selectedItem.barcode}
                            </p>
                          </div>
                        )}
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Unit of Measurement
                          </Label>
                          <p>{selectedItem.unitOfMeasurement}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Pricing Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Purchase Price
                          </Label>
                          <p className="font-bold text-lg">
                            £{parseFloat(selectedItem.purchasePrice).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Sale Price
                          </Label>
                          <p className="font-bold text-lg text-green-600">
                            £{parseFloat(selectedItem.salePrice).toFixed(2)}
                          </p>
                        </div>
                        {selectedItem.mrp && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">
                              MRP
                            </Label>
                            <p className="font-medium">
                              £{parseFloat(selectedItem.mrp).toFixed(2)}
                            </p>
                          </div>
                        )}
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Stock Value
                          </Label>
                          <p className="font-bold text-lg text-blue-600">
                            £
                            {parseFloat(
                              selectedItem.stockValue.toString(),
                            ).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Inventory Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Inventory Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <Label className="text-sm font-medium text-gray-600">
                          Current Stock
                        </Label>
                        <p className="text-2xl font-bold mt-1">
                          {selectedItem.currentStock}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedItem.unitOfMeasurement}
                        </p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <Label className="text-sm font-medium text-gray-600">
                          Minimum Stock
                        </Label>
                        <p className="text-2xl font-bold mt-1 text-orange-600">
                          {selectedItem.minimumStock}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedItem.unitOfMeasurement}
                        </p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <Label className="text-sm font-medium text-gray-600">
                          Reorder Point
                        </Label>
                        <p className="text-2xl font-bold mt-1 text-red-600">
                          {selectedItem.reorderPoint}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedItem.unitOfMeasurement}
                        </p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <Label className="text-sm font-medium text-gray-600">
                          Stock Status
                        </Label>
                        <div className="mt-1">
                          {selectedItem.isLowStock ? (
                            <Badge variant="destructive">Low Stock</Badge>
                          ) : (
                            <Badge variant="default">In Stock</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Additional Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        {selectedItem.brandName && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">
                              Brand
                            </Label>
                            <p>{selectedItem.brandName}</p>
                          </div>
                        )}
                        {selectedItem.manufacturer && (
                          <div>
                            <Label className="text-sm font-medium text-gray-600">
                              Manufacturer
                            </Label>
                            <p>{selectedItem.manufacturer}</p>
                          </div>
                        )}
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Prescription Required
                          </Label>
                          <p>
                            {selectedItem.prescriptionRequired ? "Yes" : "No"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Active Status
                          </Label>
                          <p>{selectedItem.isActive ? "Active" : "Inactive"}</p>
                        </div>
                        {selectedItem.expiryDate && (
                          <div className="col-span-2">
                            <Label className="text-sm font-medium text-gray-600">
                              Expiry Date
                            </Label>
                            <p
                              className={
                                new Date(selectedItem.expiryDate) < new Date()
                                  ? "text-red-600 font-medium"
                                  : ""
                              }
                            >
                              {format(
                                new Date(selectedItem.expiryDate),
                                "MMM dd, yyyy",
                              )}
                              {new Date(selectedItem.expiryDate) <
                                new Date() && (
                                <Badge variant="destructive" className="ml-2">
                                  Expired
                                </Badge>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Record Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Created
                          </Label>
                          <p className="text-sm">
                            {format(
                              new Date(selectedItem.createdAt),
                              "MMM dd, yyyy HH:mm",
                            )}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-600">
                            Last Updated
                          </Label>
                          <p className="text-sm">
                            {format(
                              new Date(selectedItem.updatedAt),
                              "MMM dd, yyyy HH:mm",
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  {canEdit('inventory') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowItemDetailsDialog(false);
                        setShowStockDialog(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Adjust Stock
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setShowItemDetailsDialog(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Email Dialog */}
        {showEmailDialog && selectedPOForEmail && (
          <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Send Purchase Order
                </DialogTitle>
                <DialogDescription>
                  Enter the email address to send purchase order{" "}
                  {selectedPOForEmail.poNumber}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="supplier@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Purchase order will be sent to this email address
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEmailDialog(false);
                      setEmailAddress("");
                      setSelectedPOForEmail(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmSendEmail}
                    disabled={
                      sendEmailMutation.isPending || !emailAddress.trim()
                    }
                  >
                    {sendEmailMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Are you sure you want to delete <strong>"{itemToDelete?.name}"</strong> (SKU: {itemToDelete?.sku})?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone and will permanently remove the item from your inventory database.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setItemToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteItem}
                disabled={deleteItemMutation.isPending}
              >
                {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Success Modal */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="sr-only">Item Deleted Successfully</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-6">
              <div className="rounded-full bg-green-100 dark:bg-green-900 p-4 mb-4">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Success
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {successMessage}
              </p>
              <Button
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessMessage("");
                }}
                className="mt-6 w-full"
                data-testid="button-close-delete-success"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Goods Receipt Confirmation Modal */}
        <Dialog open={showDeleteGoodsReceiptModal} onOpenChange={setShowDeleteGoodsReceiptModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this goods receipt? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteGoodsReceiptModal(false);
                  setGoodsReceiptToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteGoodsReceipt}
                disabled={deleteGoodsReceiptMutation.isPending}
              >
                {deleteGoodsReceiptMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Goods Receipt Success Modal */}
        <Dialog open={showDeleteGoodsReceiptSuccess} onOpenChange={setShowDeleteGoodsReceiptSuccess}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="sr-only">Goods Receipt Deleted Successfully</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-6">
              <div className="rounded-full bg-green-100 dark:bg-green-900 p-4 mb-4">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Success
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Goods receipt deleted successfully.
              </p>
              <Button
                onClick={() => {
                  setShowDeleteGoodsReceiptSuccess(false);
                }}
                className="mt-6 w-full"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* PDF Viewer Dialog */}
        <Dialog open={showPdfViewer} onOpenChange={(open) => {
          if (!open) {
            // Clean up blob URL when closing
            if (pdfUrl && pdfUrl.startsWith('blob:')) {
              URL.revokeObjectURL(pdfUrl);
            }
            setPdfUrl(null);
            setSelectedReceiptForPdf(null);
          }
          setShowPdfViewer(open);
        }}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>
                Goods Receipt PDF: {selectedReceiptForPdf?.receiptNumber || 'Receipt'}.pdf
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden px-6 pb-4" style={{ minHeight: '600px', height: 'calc(90vh - 120px)' }}>
              {pdfLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-gray-600">Loading PDF...</span>
                </div>
              ) : pdfUrl ? (
                <iframe 
                  src={pdfUrl} 
                  className="w-full h-full border rounded" 
                  title="Goods Receipt PDF" 
                  style={{ minHeight: '600px' }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-500">No PDF available</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6 pt-4 border-t">
              <Button onClick={() => {
                if (pdfUrl && pdfUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(pdfUrl);
                }
                setShowPdfViewer(false);
                setPdfUrl(null);
                setSelectedReceiptForPdf(null);
              }}>Close</Button>
              {pdfUrl && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        // Download PDF file
                        const response = await apiRequest('GET', `/api/inventory/goods-receipts/${selectedReceiptForPdf?.id}/pdf`);
                        if (!response.ok) {
                          throw new Error('Failed to download PDF');
                        }
                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // Create download link
                        const purchaseOrderId = selectedReceiptForPdf?.purchaseOrderId || selectedReceiptForPdf?.id;
                        const fileName = `${purchaseOrderId}.pdf`;
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = fileName;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Clean up blob URL after a delay
                        setTimeout(() => {
                          URL.revokeObjectURL(blobUrl);
                        }, 100);
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to download PDF",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      if (pdfUrl.startsWith('blob:')) {
                        window.open(pdfUrl, '_blank');
                      } else {
                        // If it's not a blob URL, fetch it again with auth
                        try {
                          const response = await apiRequest('GET', `/api/inventory/goods-receipts/${selectedReceiptForPdf?.id}/pdf`);
                          const blob = await response.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          window.open(blobUrl, '_blank');
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to open PDF",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" /> Open in New Tab
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        let urlToPrint = pdfUrl;
                        if (!pdfUrl.startsWith('blob:')) {
                          const response = await apiRequest('GET', `/api/inventory/goods-receipts/${selectedReceiptForPdf?.id}/pdf`);
                          const blob = await response.blob();
                          urlToPrint = URL.createObjectURL(blob);
                        }
                        const printWindow = window.open(urlToPrint, '_blank');
                        printWindow?.addEventListener('load', () => {
                          printWindow.print();
                        });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to print PDF",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" /> Print
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
