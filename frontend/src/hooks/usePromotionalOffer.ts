/**
 * usePromotionalOffer.ts
 * Hook for managing promotional offers in the app
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export interface PromotionalOffer {
  id: number;
  offer_type: string;
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  tier: string;
  duration_days: number;
  is_claimed: boolean;
  is_expired: boolean;
  offer_expires_at?: string;
}

export interface OfferPrice {
  price: number;
  original_price: number;
  discount_percentage: number;
  is_promotional: boolean;
  offer_expires_at?: string;
  message?: string;
}

interface UsePromotionalOfferReturn {
  offer: PromotionalOffer | null;
  loading: boolean;
  error: string | null;
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
  getOfferPrice: (tier: string) => Promise<OfferPrice>;
  claimOffer: () => Promise<boolean>;
  dismissBanner: () => void;
  hasSeenOffer: boolean;
}

const API_BASE_URL = 'http://localhost:8000/api'; // Change in production

export const usePromotionalOffer = (token: string): UsePromotionalOfferReturn => {
  const [offer, setOffer] = useState<PromotionalOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [hasSeenOffer, setHasSeenOffer] = useState(false);

  // Fetch user's promotional offer on component mount
  useEffect(() => {
    fetchOffer();
    checkIfSeenBefore();
  }, [token]);

  const checkIfSeenBefore = async () => {
    try {
      const seen = await AsyncStorage.getItem('promotional_offer_seen');
      if (seen === 'true') {
        setHasSeenOffer(true);
        setShowBanner(false);
      }
    } catch (err) {
      console.log('Error checking offer status:', err);
    }
  };

  const fetchOffer = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/promotions/offer`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data) {
        setOffer(response.data);
        setError(null);
      }
    } catch (err: any) {
      // No offer available (common for non-new users)
      if (err.response?.status === 404) {
        setOffer(null);
        setError(null);
      } else {
        setError(err.response?.data?.detail || 'Failed to fetch offer');
      }
    } finally {
      setLoading(false);
    }
  };

  const getOfferPrice = async (tier: string): Promise<OfferPrice> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/promotions/offer/price/${tier}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (err: any) {
      throw new Error(
        err.response?.data?.detail || 'Failed to get promotional price'
      );
    }
  };

  const claimOffer = async (): Promise<boolean> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/promotions/offer/claim`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        // Mark offer as claimed
        if (offer) {
          setOffer({
            ...offer,
            is_claimed: true,
            offer_used_at: new Date().toISOString(),
          });
        }

        // Remember that we've claimed the offer
        await AsyncStorage.setItem('promotional_offer_claimed', 'true');
        await AsyncStorage.setItem('promotional_offer_seen', 'true');

        // Hide banner after claiming
        setShowBanner(false);

        return true;
      }

      return false;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to claim offer');
      return false;
    }
  };

  const dismissBanner = async () => {
    setShowBanner(false);

    // Remember that user dismissed the offer
    try {
      await AsyncStorage.setItem('promotional_offer_dismissed', 'true');
      await AsyncStorage.setItem('promotional_offer_seen', 'true');
      setHasSeenOffer(true);
    } catch (err) {
      console.log('Error dismissing offer:', err);
    }
  };

  return {
    offer,
    loading,
    error,
    showBanner,
    setShowBanner,
    getOfferPrice,
    claimOffer,
    dismissBanner,
    hasSeenOffer,
  };
};
