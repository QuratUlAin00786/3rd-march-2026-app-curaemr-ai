import { useState, useEffect, useCallback } from 'react';
import { socketManager, buildSocketUserIdentifier } from '@/lib/socket-manager';
import type { IncomingCallData } from '@/components/telemedicine/incoming-call-modal';

export interface UseIncomingCallReturn {
  incomingCall: IncomingCallData | null;
  acceptCall: (callData: IncomingCallData) => void;
  declineCall: () => void;
  clearIncomingCall: () => void;
}

export function useIncomingCall(): UseIncomingCallReturn {
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

  useEffect(() => {
    // Listen for incoming call events
    const unsubscribe = socketManager.on('incoming_call', (callData: any) => {
      console.log('📞 Incoming call received in hook:', callData);
      console.log('📞 Incoming call - roomId:', callData.roomId);
      console.log('📞 Incoming call - fromUserId:', callData.fromUserId);
      console.log('📞 Incoming call - fromUsername:', callData.fromUsername);
      console.log('📞 Incoming call - token exists:', !!callData.token);
      console.log('📞 Incoming call - serverUrl:', callData.serverUrl);
      console.log('📞 Incoming call - isVideo:', callData.isVideo);

      // Check if token is missing - this would prevent accepting the call
      if (!callData.token) {
        console.error('📞 WARNING: Incoming call is missing token - call may not work properly');
      }

      // Transform the call data to match our interface
      const transformedCallData: IncomingCallData = {
        roomId: callData.roomId,
        fromUserId: callData.fromUserId,
        fromUsername: callData.fromUsername,
        isVideo: callData.isVideo || false,
        participants: callData.participants || [],
        isGroup: callData.isGroup || false,
        groupName: callData.groupName || null,
        token: callData.token,
        serverUrl: callData.serverUrl,
        e2eeKey: callData.e2eeKey,
        isDelayedCall: callData.isDelayedCall || false,
      };

      console.log('📞 Transformed call data:', transformedCallData);
      setIncomingCall(transformedCallData);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const acceptCall = useCallback((callData: IncomingCallData) => {
    console.log('✅ Accepting incoming call:', callData);
    setIncomingCall(null);
    // The actual joining will be handled by the component that uses this hook
  }, []);

  const declineCall = useCallback(() => {
    console.log('❌ Declining incoming call');
    const currentCall = incomingCall;
    setIncomingCall(null);
    
    // Emit decline event to server with all required fields
    if (currentCall) {
      // Get the current user's socket identifier
      const authToken = localStorage.getItem('auth_token');
      let toUserId = '';
      
      // Try to get current user ID from token
      if (authToken) {
        try {
          const payload = JSON.parse(atob(authToken.split('.')[1]));
          // Build a basic identifier - the server uses this to notify caller
          toUserId = `${payload.userId}_declining-user`;
        } catch (e) {
          console.error('Failed to decode auth token:', e);
        }
      }
      
      socketManager.emitToServer('call_declined', {
        roomId: currentCall.roomId,
        fromUserId: currentCall.fromUserId,
        toUserId: toUserId,
        isGroup: currentCall.isGroup || false,
      });
      
      console.log('[IncomingCall] Emitted call_declined:', {
        roomId: currentCall.roomId,
        fromUserId: currentCall.fromUserId,
        toUserId: toUserId,
      });
    }
  }, [incomingCall]);

  const clearIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return {
    incomingCall,
    acceptCall,
    declineCall,
    clearIncomingCall,
  };
}

