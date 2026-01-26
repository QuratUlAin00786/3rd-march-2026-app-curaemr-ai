import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { getActiveSubdomain } from "@/lib/subdomain-utils";
import { useAuth } from "@/hooks/use-auth";
import { createRemoteLiveKitRoom } from "@/lib/livekit-room-service";
import { buildSocketUserIdentifier, socketManager } from "@/lib/socket-manager";
import { LiveKitVideoCall } from "@/components/telemedicine/livekit-video-call";
import { LiveKitAudioCall } from "@/components/telemedicine/livekit-audio-call";
import { useSocket } from "@/hooks/use-socket";
import { isUserOnline } from "@/lib/socket-user-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Camera,
  CameraOff,
  Monitor,
  Users,
  Clock,
  Calendar,
  FileText,
  Stethoscope,
  Heart,
  Activity,
  Settings,
  Square,
  Play,
  Pause,
  Download,
  Share2,
  MessageSquare,
  MonitorSpeaker,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Trash2,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRolePermissions } from "@/hooks/use-role-permissions";

interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  type: "video" | "audio" | "screen_share";
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "waiting";
  scheduledTime: string;
  duration?: number;
  notes?: string;
  recordings?: Array<{
    id: string;
    name: string;
    duration: number;
    size: string;
    url: string;
  }>;
  prescriptions?: Array<{
    medication: string;
    dosage: string;
    instructions: string;
  }>;
  vitalSigns?: {
    heartRate?: number;
    bloodPressure?: string;
    temperature?: number;
    oxygenSaturation?: number;
  };
}

interface WaitingRoom {
  patientId: string;
  patientName: string;
  appointmentTime: string;
  waitTime: number;
  priority: "normal" | "urgent";
  status: "waiting" | "ready" | "in_call";
}

// Patient List Component for selecting patients for telemedicine consultations
function PatientList() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canCreate } = useRolePermissions();
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // LiveKit call state
  const [liveKitVideoCall, setLiveKitVideoCall] = useState<{
    roomName: string;
    patient: any;
    token?: string;
    serverUrl?: string;
    e2eeKey?: string;
  } | null>(null);
  const [liveKitAudioCall, setLiveKitAudioCall] = useState<{
    roomName: string;
    patient: any;
    token?: string;
    serverUrl?: string;
    e2eeKey?: string;
  } | null>(null);

  // Note: Incoming call is now handled globally by GlobalIncomingCallBar

  // Socket.IO online users
  const { onlineUsers } = useSocket();

  // Fetch users for telemedicine - filtered based on role
  // Admin users see all users, non-admin users see only non-patient users
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/telemedicine/users"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/telemedicine/users", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch telemedicine users");
      }
      return response.json();
    },
    enabled: true,
  });

  // BigBlueButton video call function
  const startBigBlueButtonCall = async (patient: any) => {
    try {
      const response = await fetch("/api/video-conference/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: JSON.stringify({
          meetingName: `Consultation with ${patient.firstName} ${patient.lastName}`,
          participantName: `${patient.firstName} ${patient.lastName}`,
          duration: 30,
          maxParticipants: 10,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        console.error("BigBlueButton API failed, using fallback");
        // Fallback: Show message about video consultation
        toast({
          title: "Video Call Initiated",
          description: `Starting video consultation with ${patient.firstName} ${patient.lastName}. Please use your preferred video platform or call ${patient.phone || "phone number not available"}`,
          variant: "default",
        });
        return;
      }

      const meetingData = await response.json();

      // Open BigBlueButton meeting in new window - use moderator URL for doctor
      const meetingWindow = window.open(
        meetingData.moderatorJoinUrl,
        "_blank",
        "width=1200,height=800,scrollbars=yes,resizable=yes",
      );

      if (
        !meetingWindow ||
        meetingWindow.closed ||
        typeof meetingWindow.closed == "undefined"
      ) {
        // Popup was blocked - provide fallback
        toast({
          title: "Popup Blocked",
          description:
            "Your browser blocked the meeting popup. Please allow popups and try again, or copy the meeting URL from the browser console.",
          variant: "default",
        });

        // Log the meeting URL for users to manually open
        console.log("BigBlueButton Meeting URL:", meetingData.moderatorJoinUrl);

        // Also try to open in the same tab as fallback
        window.location.href = meetingData.moderatorJoinUrl;
        return; // Don't throw error, just redirect
      }

      toast({
        title: "Video Call Started",
        description: `Opening BigBlueButton meeting with ${patient.firstName} ${patient.lastName}`,
      });

      // Create consultation record
      await fetch("/api/telemedicine/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: JSON.stringify({
          patientId: patient.id,
          type: "video",
          scheduledTime: new Date().toISOString(),
          duration: 30,
          meetingId: meetingData.meetingID,
        }),
        credentials: "include",
      });
    } catch (error) {
      // Fallback: Show message about video consultation
      toast({
        title: "Video Call Initiated",
        description: `Starting video consultation with ${patient.firstName} ${patient.lastName}. Please use your preferred video platform or call ${patient.phone || "phone number not available"}`,
        variant: "default",
      });
    }
  };

  // LiveKit audio call function
  const startAveroxAudioCall = async (patient: any) => {
    try {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to start an audio call",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Connecting...",
        description: `Initializing audio call with ${patient.firstName} ${patient.lastName}`,
      });

      // Create LiveKit room for audio call
      const roomName = `audio-call-${user.id}-${patient.id}-${Date.now()}`;
      const socketUserId = buildSocketUserIdentifier(user);
      const targetSocketId = buildSocketUserIdentifier(patient);

      if (!socketUserId || !targetSocketId) {
        throw new Error("Unable to build user identifiers for call");
      }

      const roomData = await createRemoteLiveKitRoom({
        roomId: roomName,
        fromUsername: `${user.firstName} ${user.lastName}`,
        toUsers: [
          {
            identifier: targetSocketId,
            displayName: `${patient.firstName} ${patient.lastName}`,
          },
        ],
        isVideo: false, // Audio only call
      });

      if (roomData) {
        setLiveKitAudioCall({
          roomName: roomData.roomId,
          patient,
          token: roomData.token,
          serverUrl: roomData.serverUrl,
          e2eeKey: roomData.e2eeKey,
        });

        // Start call duration timer
        setCallDuration(0);
        callTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);

        toast({
          title: "Call Connected",
          description: `Audio call with ${patient.firstName} ${patient.lastName} is now active`,
        });

        // Create consultation record
        await fetch("/api/telemedicine/consultations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            "X-Tenant-Subdomain": getActiveSubdomain(),
          },
          body: JSON.stringify({
            patientId: patient.id,
            type: "audio",
            scheduledTime: new Date().toISOString(),
            duration: 30,
            meetingId: roomName,
          }),
          credentials: "include",
        });
      }
    } catch (error: any) {
      console.error("💥 Audio call failed:", error);
      toast({
        title: "Call Failed",
        description:
          error.message ||
          "Unable to start audio call. Please check microphone permissions and try again.",
        variant: "destructive",
      });
    }
  };

  // Handle ending audio call
  const handleEndAudioCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    setLiveKitAudioCall(null);
    setIsAudioMuted(false);
    setCallDuration(0);

    toast({
      title: "Call Ended",
      description: "Audio call has been terminated",
    });
  };

  // Toggle mute - handled by LiveKit component internally
  const toggleAudioMute = () => {
    setIsAudioMuted(!isAudioMuted);
    toast({
      title: !isAudioMuted ? "Microphone Muted" : "Microphone Unmuted",
      description: !isAudioMuted
        ? "Your microphone is now muted"
        : "Your microphone is now active",
    });
  };

  // LiveKit Video Call
  const buildParticipantIdentifier = (
    entity: any,
    defaultRole = "participant",
  ) => {
    return buildSocketUserIdentifier({
      id: entity?.id,
      firstName: entity?.firstName,
      lastName: entity?.lastName,
      email: entity?.email,
      role: entity?.role || defaultRole,
    });
  };

  const getDisplayName = (entity: any) => {
    const name = [entity?.firstName, entity?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return name || entity?.email || `user-${entity?.id}`;
  };

  const startLiveKitVideoCall = async (patient: any) => {
    try {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to start a video call",
          variant: "destructive",
        });
        return;
      }

      const fromIdentifier = buildParticipantIdentifier(user, user.role);
      const toIdentifier = buildParticipantIdentifier(patient, patient.role);

      if (!fromIdentifier || !toIdentifier) {
        toast({
          title: "Call Failed",
          description: "Unable to determine participant identifiers",
          variant: "destructive",
        });
        return;
      }

      const roomName = `telemedicine-video-${user.id}-${patient.id}-${Date.now()}`;

      toast({
        title: "Video Call Starting",
        description: `Connecting to video call with ${patient.firstName} ${patient.lastName}`,
      });

      const liveKitRoom = await createRemoteLiveKitRoom({
        roomId: roomName,
        fromUsername: fromIdentifier,
        toUsers: [
          {
            identifier: toIdentifier,
            displayName: getDisplayName(patient),
          },
        ],
        isVideo: true,
        groupName: "Telemedicine Video Consultation",
      });

      const finalRoomId = liveKitRoom.roomId || roomName;

      setLiveKitVideoCall({
        roomName: finalRoomId,
        patient,
        token: liveKitRoom.token,
        serverUrl: liveKitRoom.serverUrl,
        e2eeKey: liveKitRoom.e2eeKey,
      });

      // Start call duration timer for video call
      setCallDuration(0);
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Create consultation record
      await fetch("/api/telemedicine/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: JSON.stringify({
          patientId: patient.id,
          type: "video",
          scheduledTime: new Date().toISOString(),
          duration: 30,
          meetingId: finalRoomId,
        }),
        credentials: "include",
      });
    } catch (error: any) {
      console.error("LiveKit video call failed:", error);
      toast({
        title: "Call Failed",
        description: error.message || "Unable to start video call",
        variant: "destructive",
      });
    }
  };

  // LiveKit Audio Call
  const startLiveKitAudioCall = async (patient: any) => {
    try {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to start an audio call",
          variant: "destructive",
        });
        return;
      }

      const fromIdentifier = buildParticipantIdentifier(user, user.role);
      const toIdentifier = buildParticipantIdentifier(patient, patient.role);

      if (!fromIdentifier || !toIdentifier) {
        toast({
          title: "Call Failed",
          description: "Unable to determine participant identifiers",
          variant: "destructive",
        });
        return;
      }

      const roomName = `telemedicine-audio-${user.id}-${patient.id}-${Date.now()}`;

      toast({
        title: "Audio Call Starting",
        description: `Connecting to audio call with ${patient.firstName} ${patient.lastName}`,
      });

      const liveKitRoom = await createRemoteLiveKitRoom({
        roomId: roomName,
        fromUsername: fromIdentifier,
        toUsers: [
          {
            identifier: toIdentifier,
            displayName: getDisplayName(patient),
          },
        ],
        isVideo: false,
        groupName: "Telemedicine Audio Consultation",
      });

      const finalRoomId = liveKitRoom.roomId || roomName;

      setLiveKitAudioCall({
        roomName: finalRoomId,
        patient,
        token: liveKitRoom.token,
        serverUrl: liveKitRoom.serverUrl,
        e2eeKey: liveKitRoom.e2eeKey,
      });

      // Create consultation record
      await fetch("/api/telemedicine/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: JSON.stringify({
          patientId: patient.id,
          type: "audio",
          scheduledTime: new Date().toISOString(),
          duration: 30,
          meetingId: finalRoomId,
        }),
        credentials: "include",
      });
    } catch (error: any) {
      console.error("LiveKit audio call failed:", error);
      toast({
        title: "Call Failed",
        description: error.message || "Unable to start audio call",
        variant: "destructive",
      });
    }
  };

  const handleLiveKitVideoCallEnd = () => {
    // Stop call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);

    // Emit call_ended event to notify the other participant
    if (liveKitVideoCall && user) {
      const initiatorUserId = buildSocketUserIdentifier(user);
      const participantId = buildSocketUserIdentifier(liveKitVideoCall.patient);
      
      if (initiatorUserId && participantId) {
        socketManager.emitToServer('call_ended', {
          roomId: liveKitVideoCall.roomName,
          initiatorUserId: initiatorUserId,
          participantIds: [participantId],
        });
        console.log('[Telemedicine] Emitted call_ended for video call:', liveKitVideoCall.roomName);
      }
    }
    
    setLiveKitVideoCall(null);
    toast({
      title: "Call Ended",
      description: "Video call has been terminated",
    });
  };

  const handleLiveKitAudioCallEnd = () => {
    // Stop call timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);

    // Emit call_ended event to notify the other participant
    if (liveKitAudioCall && user) {
      const initiatorUserId = buildSocketUserIdentifier(user);
      const participantId = buildSocketUserIdentifier(liveKitAudioCall.patient);
      
      if (initiatorUserId && participantId) {
        socketManager.emitToServer('call_ended', {
          roomId: liveKitAudioCall.roomName,
          initiatorUserId: initiatorUserId,
          participantIds: [participantId],
        });
        console.log('[Telemedicine] Emitted call_ended for audio call:', liveKitAudioCall.roomName);
      }
    }
    
    setLiveKitAudioCall(null);
    toast({
      title: "Call Ended",
      description: "Audio call has been terminated",
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  // Listen for call_ended and call_declined events from other participants
  useEffect(() => {
    // Handle when the other party ends the call
    const unsubscribeCallEnded = socketManager.on('call_ended', (data: any) => {
      console.log('[Telemedicine] Received call_ended event:', data);
      
      // Check if this is for our current video call
      if (liveKitVideoCall && data.roomId === liveKitVideoCall.roomName) {
        console.log('[Telemedicine] Closing video call - other party ended');
        // Stop call timer
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        setCallDuration(0);
        setLiveKitVideoCall(null);
        toast({
          title: "Call Ended",
          description: "The other participant ended the call",
        });
      }
      
      // Check if this is for our current audio call
      if (liveKitAudioCall && data.roomId === liveKitAudioCall.roomName) {
        console.log('[Telemedicine] Closing audio call - other party ended');
        // Stop call timer
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        setCallDuration(0);
        setLiveKitAudioCall(null);
        toast({
          title: "Call Ended",
          description: "The other participant ended the call",
        });
      }
    });

    // Handle when an incoming call is declined
    const unsubscribeCallDeclined = socketManager.on('call_declined', (data: any) => {
      console.log('[Telemedicine] Received call_declined event:', data);
      
      // Check if this is for our current video call
      if (liveKitVideoCall && data.roomId === liveKitVideoCall.roomName) {
        console.log('[Telemedicine] Closing video call - call was declined');
        // Stop call timer
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        setCallDuration(0);
        // Setting to null will unmount LiveKitVideoCall which cleans up camera/tracks
        setLiveKitVideoCall(null);
        toast({
          title: "Call Declined",
          description: "The recipient declined the call",
        });
      }
      
      // Check if this is for our current audio call
      if (liveKitAudioCall && data.roomId === liveKitAudioCall.roomName) {
        console.log('[Telemedicine] Closing audio call - call was declined');
        // Stop call timer
        if (callTimerRef.current) {
          clearInterval(callTimerRef.current);
          callTimerRef.current = null;
        }
        setCallDuration(0);
        setLiveKitAudioCall(null);
        toast({
          title: "Call Declined",
          description: "The recipient declined the call",
        });
      }
    });

    return () => {
      unsubscribeCallEnded();
      unsubscribeCallDeclined();
    };
  }, [liveKitVideoCall, liveKitAudioCall, toast]);

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // BigBlueButton audio call function
  const startBigBlueButtonAudioCall = async (patient: any) => {
    try {
      const response = await fetch("/api/video-conference/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: JSON.stringify({
          meetingName: `Audio Consultation with ${patient.firstName} ${patient.lastName}`,
          participantName: `${patient.firstName} ${patient.lastName}`,
          duration: 30,
          maxParticipants: 10,
          disableVideo: true, // Audio-only mode
          webcamsOnlyForModerator: false,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        console.error("BigBlueButton API failed, using fallback");
        // Fallback: Show phone number for direct call
        toast({
          title: "Audio Call Initiated",
          description: `Please call ${patient.firstName} ${patient.lastName} at ${patient.phone || "phone number not available"}`,
          variant: "default",
        });
        return;
      }

      const meetingData = await response.json();

      // Open BigBlueButton audio meeting in new window - use moderator URL for doctor
      const meetingWindow = window.open(
        meetingData.moderatorJoinUrl,
        "_blank",
        "width=800,height=600,scrollbars=yes,resizable=yes",
      );

      if (
        !meetingWindow ||
        meetingWindow.closed ||
        typeof meetingWindow.closed == "undefined"
      ) {
        // Popup was blocked - provide fallback
        toast({
          title: "Popup Blocked",
          description:
            "Your browser blocked the meeting popup. Please allow popups and try again, or copy the meeting URL from the browser console.",
          variant: "default",
        });

        // Log the meeting URL for users to manually open
        console.log(
          "BigBlueButton Audio Meeting URL:",
          meetingData.moderatorJoinUrl,
        );

        // Also try to open in the same tab as fallback
        window.location.href = meetingData.moderatorJoinUrl;
        return; // Don't throw error, just redirect
      }

      toast({
        title: "Audio Call Started",
        description: `Opening audio consultation with ${patient.firstName} ${patient.lastName}`,
      });

      // Create consultation record
      await fetch("/api/telemedicine/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
        body: JSON.stringify({
          patientId: patient.id,
          type: "audio",
          scheduledTime: new Date().toISOString(),
          duration: 30,
          meetingId: meetingData.meetingID,
        }),
        credentials: "include",
      });
    } catch (error) {
      // Fallback: Show phone number for direct call
      toast({
        title: "Audio Call Initiated",
        description: `Please call ${patient.firstName} ${patient.lastName} at ${patient.phone || "phone number not available"}`,
        variant: "default",
      });
    }
  };

  if (patientsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border rounded-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!patients || !Array.isArray(patients) || patients.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-300">
          {user?.role === "admin"
            ? "No users available for consultation"
            : "No staff members available for consultation"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.filter((patient: any) => patient.id !== user?.id).map((patient: any) => (
          <Card
            key={patient.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback>
                      {patient.firstName?.[0] || patient.email?.[0]}
                      {patient.lastName?.[0] || patient.email?.[1]}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online Status Indicator */}
                  {isUserOnline(patient.id, onlineUsers) && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-lg text-gray-900 dark:text-gray-100">
                    {patient.firstName && patient.lastName
                      ? `${patient.firstName} ${patient.lastName}`
                      : patient.email}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <span>
                      {patient.role
                        ? patient.role.charAt(0).toUpperCase() +
                          patient.role.slice(1)
                        : "User"}{" "}
                      • ID: {patient.id}
                    </span>
                    {isUserOnline(patient.id, onlineUsers) && (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Online
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="truncate">{patient.email || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>{patient.phone || "N/A"}</span>
                </div>
              </div>

              <div className="flex gap-2">
                {canCreate('telemedicine') && (
                  <Button
                    onClick={() => startLiveKitVideoCall(patient)}
                    className="flex-1"
                    size="sm"
                    variant="default"
                    data-testid={`button-livekit-video-call-${patient.id}`}
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Video
                  </Button>
                )}
                {canCreate('telemedicine') && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => startLiveKitAudioCall(patient)}
                    data-testid={`button-livekit-audio-call-${patient.id}`}
                    disabled={liveKitAudioCall !== null}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Audio
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Audio Call UI Controls */}
      {liveKitAudioCall && (
        <Card className="fixed bottom-4 right-4 w-96 shadow-2xl border-2 border-primary z-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-ping absolute top-0 left-0" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Audio Call Active</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {liveKitAudioCall.patient?.firstName}{" "}
                    {liveKitAudioCall.patient?.lastName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-primary">
                  {formatCallDuration(callDuration)}
                </p>
                <p className="text-xs text-gray-500">Duration</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant={isAudioMuted ? "destructive" : "outline"}
                size="lg"
                onClick={toggleAudioMute}
                className="flex-1"
                data-testid="button-toggle-mute"
              >
                {isAudioMuted ? (
                  <>
                    <MicOff className="w-5 h-5 mr-2" />
                    Unmute
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    Mute
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={handleEndAudioCall}
                className="flex-1"
                data-testid="button-end-call"
              >
                <PhoneOff className="w-5 h-5 mr-2" />
                End Call
              </Button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <Activity className="w-4 h-4" />
                <span>LiveKit Audio Call</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LiveKit Video Call Modal - Full Screen */}
      {liveKitVideoCall && (
        <Dialog
          open={!!liveKitVideoCall}
          onOpenChange={() => handleLiveKitVideoCallEnd()}
        >
          <DialogContent className="max-w-none w-screen h-screen p-0 m-0 rounded-none border-none">
            <DialogHeader className="p-4 border-b absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur">
              <DialogTitle className="flex items-center justify-between gap-4">
                <span>Video Call - {liveKitVideoCall.patient.firstName}{" "}
                {liveKitVideoCall.patient.lastName}</span>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatCallDuration(callDuration)}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="w-full h-full pt-16">
              <LiveKitVideoCall
                roomName={liveKitVideoCall.roomName}
                participantName={
                  user ? `${user.firstName} ${user.lastName}` : "Provider"
                }
                token={liveKitVideoCall.token}
                serverUrl={liveKitVideoCall.serverUrl}
                onDisconnect={handleLiveKitVideoCallEnd}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* LiveKit Audio Call Modal */}
      {liveKitAudioCall && (
        <Dialog
          open={!!liveKitAudioCall}
          onOpenChange={() => handleLiveKitAudioCallEnd()}
        >
          <DialogContent className="max-w-2xl w-full">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-4">
                <span>Audio Call - {liveKitAudioCall.patient.firstName}{" "}
                {liveKitAudioCall.patient.lastName}</span>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatCallDuration(callDuration)}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <LiveKitAudioCall
                roomName={liveKitAudioCall.roomName}
                participantName={
                  user ? `${user.firstName} ${user.lastName}` : "Provider"
                }
                token={liveKitAudioCall.token}
                serverUrl={liveKitAudioCall.serverUrl}
                onDisconnect={handleLiveKitAudioCallEnd}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

    </>
  );
}

export default function Telemedicine() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("consultations");
  const [currentCall, setCurrentCall] = useState<Consultation | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const { canCreate } = useRolePermissions();

  // Fetch consultations
  const { data: consultations, isLoading: consultationsLoading } = useQuery({
    queryKey: ["/api/telemedicine/consultations"],
    enabled: true,
  });

  // Fetch waiting room
  const { data: waitingRoom, isLoading: waitingLoading } = useQuery({
    queryKey: ["/api/telemedicine/waiting-room"],
    enabled: true,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch users for scheduling - filtered based on role
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/telemedicine/users"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/telemedicine/users", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch telemedicine users");
      }
      return response.json();
    },
    enabled: true,
  });

  // Start consultation mutation
  const startConsultationMutation = useMutation({
    mutationFn: async (consultationId: string) => {
      const response = await fetch(
        `/api/telemedicine/consultations/${consultationId}/start`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to start consultation");
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentCall(data);
      queryClient.invalidateQueries({
        queryKey: ["/api/telemedicine/consultations"],
      });
      setSuccessMessage("Consultation started");
      setShowSuccessModal(true);
    },
    onError: () => {
      toast({ title: "Failed to start consultation", variant: "destructive" });
    },
  });

  // Delete patient mutation
  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: number) => {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Subdomain": getActiveSubdomain(),
        },
      });
      if (!response.ok) throw new Error("Failed to delete patient");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Patient Deleted",
        description: "Patient has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      setSelectedPatient(null);
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete patient. Please try again.",
        variant: "destructive",
      });
    },
  });

  // End consultation mutation
  const endConsultationMutation = useMutation({
    mutationFn: async (data: {
      consultationId: string;
      notes: string;
      duration: number;
    }) => {
      const response = await fetch(
        `/api/telemedicine/consultations/${data.consultationId}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: data.notes, duration: data.duration }),
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to end consultation");
      return response.json();
    },
    onSuccess: () => {
      // Stop video stream first
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      setCurrentCall(null);
      setCallNotes("");
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      setIsRecording(false);
      queryClient.invalidateQueries({
        queryKey: ["/api/telemedicine/consultations"],
      });
      setSuccessMessage("Consultation ended and notes saved");
      setShowSuccessModal(true);
    },
    onError: (error) => {
      // Even if the API call fails, still end the call locally
      console.error("Error ending consultation:", error);

      // Stop video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      setCurrentCall(null);
      setCallNotes("");
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      setIsRecording(false);
      toast({
        title: "Call ended",
        description:
          "Notes may not have been saved. Please check consultation history.",
        variant: "destructive",
      });
    },
  });

  // Mock data
  const mockConsultations: Consultation[] = [
    {
      id: "consult_1",
      patientId: "patient_1",
      patientName: "Sarah Johnson",
      providerId: "provider_1",
      providerName: "Dr. Emily Watson",
      type: "video",
      status: "scheduled",
      scheduledTime: "2024-06-26T15:00:00Z",
      vitalSigns: {
        heartRate: 72,
        bloodPressure: "120/80",
        temperature: 98.6,
        oxygenSaturation: 98,
      },
    },
    {
      id: "consult_2",
      patientId: "patient_2",
      patientName: "Michael Chen",
      providerId: "provider_1",
      providerName: "Dr. Emily Watson",
      type: "video",
      status: "completed",
      scheduledTime: "2024-06-26T14:00:00Z",
      duration: 25,
      notes:
        "Follow-up consultation for hypertension management. Patient reports improved symptoms.",
      recordings: [
        {
          id: "rec_1",
          name: "Consultation Recording",
          duration: 25,
          size: "150 MB",
          url: "#",
        },
      ],
      prescriptions: [
        {
          medication: "Lisinopril",
          dosage: "10mg",
          instructions: "Take once daily in the morning",
        },
      ],
    },
  ];

  const mockWaitingRoom: WaitingRoom[] = [
    {
      patientId: "patient_3",
      patientName: "Emma Davis",
      appointmentTime: "2024-06-26T15:30:00Z",
      waitTime: 5,
      priority: "normal",
      status: "waiting",
    },
    {
      patientId: "patient_4",
      patientName: "James Wilson",
      appointmentTime: "2024-06-26T15:15:00Z",
      waitTime: 12,
      priority: "urgent",
      status: "ready",
    },
  ];

  // Initialize video stream when component mounts
  useEffect(() => {
    if (videoRef.current && currentCall) {
      navigator.mediaDevices
        .getUserMedia({ video: isVideoEnabled, audio: isAudioEnabled })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Error accessing media devices:", err);
          toast({
            title: "Camera/microphone access denied",
            description:
              "Please allow access to continue with video consultation",
            variant: "destructive",
          });
        });
    }
  }, [currentCall, isVideoEnabled, isAudioEnabled]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-green-100 text-green-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
      }
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
      }
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    setSuccessMessage(
      isRecording
        ? "Consultation recording has been saved"
        : "Consultation is now being recorded",
    );
    setShowSuccessModal(true);
  };

  const endCall = () => {
    if (currentCall) {
      endConsultationMutation.mutate({
        consultationId: currentCall.id,
        notes: callNotes,
        duration: 15, // Mock duration
      });
    }
  };

  // Video consultation interface
  if (currentCall) {
    return (
      <div className="h-screen bg-gray-900 flex flex-col">
        {/* Video area */}
        <div className="flex-1 relative">
          <div className="absolute inset-0">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
          </div>

          {/* Patient info overlay */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {currentCall.patientName
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("") || "P"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{currentCall.patientName}</div>
                <div className="text-sm opacity-75">Video Consultation</div>
              </div>
            </div>
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm">Recording</span>
            </div>
          )}

          {/* Call duration */}
          <div className="absolute top-4 right-20 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
            <Clock className="w-4 h-4 inline mr-1" />
            <span className="text-sm">00:15:32</span>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-4">
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant={isVideoEnabled ? "secondary" : "destructive"}
              onClick={toggleVideo}
              className="rounded-full w-12 h-12"
            >
              {isVideoEnabled ? (
                <Video className="w-6 h-6" />
              ) : (
                <VideoOff className="w-6 h-6" />
              )}
            </Button>

            <Button
              size="lg"
              variant={isAudioEnabled ? "secondary" : "destructive"}
              onClick={toggleAudio}
              className="rounded-full w-12 h-12"
            >
              {isAudioEnabled ? (
                <Mic className="w-6 h-6" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              onClick={toggleRecording}
              className="rounded-full w-12 h-12"
            >
              {isRecording ? (
                <Square className="w-6 h-6 text-red-500" />
              ) : (
                <Square className="w-6 h-6" />
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="rounded-full w-12 h-12"
            >
              <MonitorSpeaker className="w-6 h-6" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="rounded-full w-12 h-12"
            >
              <MessageSquare className="w-6 h-6" />
            </Button>

            <Button
              size="lg"
              variant="destructive"
              onClick={endCall}
              className="rounded-full w-12 h-12"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>

          {/* Notes area */}
          <div className="mt-4 max-w-md mx-auto">
            <Input
              placeholder="Add consultation notes..."
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Telemedicine
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Virtual consultations and remote patient care
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {canCreate('telemedicine') && (
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Consultation
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule New Consultation</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Patient Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Patient
                  </label>
                  <Popover
                    open={patientSearchOpen}
                    onOpenChange={setPatientSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={patientSearchOpen}
                        className="w-full justify-between"
                      >
                        {selectedPatient
                          ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                          : "Select a patient..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search patients..." />
                        <CommandEmpty>No patients found.</CommandEmpty>
                        <CommandGroup>
                          <CommandList className="max-h-[200px]">
                            {patientsLoading ? (
                              <CommandItem disabled>
                                Loading patients...
                              </CommandItem>
                            ) : (
                              patients?.map((patient: any) => (
                                <CommandItem
                                  key={patient.id}
                                  value={`${patient.firstName} ${patient.lastName}`}
                                  onSelect={() => {
                                    setSelectedPatient(patient);
                                    setPatientSearchOpen(false);
                                  }}
                                  className="flex items-center"
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedPatient?.id === patient.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    }`}
                                  />
                                  <div>
                                    <div>
                                      {patient.firstName} {patient.lastName}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      ID: {patient.patientId || patient.id}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))
                            )}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Provider Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Provider
                  </label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="">Select a provider...</option>
                    <option value="provider_1">Dr. Emily Watson</option>
                    <option value="provider_2">Dr. David Smith</option>
                    <option value="provider_3">Dr. Lisa Anderson</option>
                  </select>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Date
                    </label>
                    <Input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Time
                    </label>
                    <Input type="time" />
                  </div>
                </div>

                {/* Consultation Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Consultation Type
                  </label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="video">Video Consultation</option>
                    <option value="audio">Audio Only</option>
                    <option value="screen_share">Screen Share</option>
                  </select>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Duration
                  </label>
                  <select className="w-full p-2 border rounded-md">
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full p-2 border rounded-md h-20 resize-none"
                    placeholder="Add any special instructions or notes for this consultation..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => {
                      toast({
                        title: "Consultation Scheduled",
                        description:
                          "New consultation has been scheduled successfully. Patient will receive confirmation.",
                      });
                      setScheduleOpen(false);
                    }}
                    className="flex-1"
                  >
                    Schedule Consultation
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Save as Draft
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          )}

          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Telemedicine Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Video Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Video & Audio Settings
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Default Video Quality
                      </label>
                      <select className="w-32 p-2 border rounded-md text-sm">
                        <option value="720p">720p HD</option>
                        <option value="1080p">1080p Full HD</option>
                        <option value="480p">480p Standard</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Auto-start Video
                      </label>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        defaultChecked
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Auto-start Audio
                      </label>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        defaultChecked
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Echo Cancellation
                      </label>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        defaultChecked
                      />
                    </div>
                  </div>
                </div>

                {/* Recording Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Recording Settings
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Auto-record Consultations
                      </label>
                      <input type="checkbox" className="w-4 h-4" />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Recording Quality
                      </label>
                      <select className="w-32 p-2 border rounded-md text-sm">
                        <option value="high">High Quality</option>
                        <option value="medium">Medium Quality</option>
                        <option value="low">Low Quality</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Patient Consent Required
                      </label>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        defaultChecked
                      />
                    </div>
                  </div>
                </div>

                {/* Notification Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Notifications
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Appointment Reminders
                      </label>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        defaultChecked
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Patient Waiting Alerts
                      </label>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        defaultChecked
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Connection Issues Alerts
                      </label>
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        defaultChecked
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => {
                      setSuccessMessage(
                        "Telemedicine settings have been updated successfully.",
                      );
                      setShowSuccessModal(true);
                      setSettingsOpen(false);
                    }}
                    className="flex-1"
                  >
                    Save Settings
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Reset to Default
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Patient Selection for New Consultation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Consultation via Audio or Video
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Start a new telemedicine consultation
          </p>
        </CardHeader>
        <CardContent>
          <PatientList />
        </CardContent>
      </Card>


      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-600">
              Success
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-gray-700">{successMessage}</p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                setSuccessMessage("");
              }}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
