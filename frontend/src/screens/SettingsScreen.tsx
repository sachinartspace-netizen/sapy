import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { getAuth } from '../utils/auth';
import { licenseService } from '../services/licenseService';
import { messageLimitService } from '../services/messageLimitService';

const SettingsScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState<string>('FREE');
  const [usageString, setUsageString] = useState<string>('0 / 55');
  const [daysRemaining, setDaysRemaining] = useState<number>(365);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      const tier = licenseService.getCurrentTier();
      setCurrentTier(tier);

      const usage = await messageLimitService.getDailyUsage();
      setUsageString(`${usage.messagesUsed} / ${usage.messagesLimit}`);

      const license = licenseService.getCurrentLicense();
      if (license) {
        const days = licenseService.getDaysUntilExpiry();
        setDaysRemaining(days);
      }
    } catch (error) {
      console.error('Error loading subscription info:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.logout();
              // Navigation will happen automatically via App.tsx
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to logout');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <TouchableOpacity
            style={[
              styles.subscriptionCard,
              currentTier === 'PREMIUM' && styles.subscriptionCardPremium,
            ]}
            onPress={() => navigation.navigate('Subscription')}
          >
            <View>
              <Text style={styles.subscriptionTier}>{currentTier} Plan</Text>
              <Text style={styles.subscriptionDesc}>
                {usageString} messages used today
              </Text>
              {daysRemaining > 0 && currentTier !== 'FREE' && (
                <Text style={styles.subscriptionExpiry}>
                  Renews in {daysRemaining} days
                </Text>
              )}
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>App Version</Text>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Build</Text>
            <Text style={styles.settingValue}>1</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>
          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingLabel}>Terms of Service</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingButton}>
            <Text style={styles.settingLabel}>Delete Account</Text>
            <Text style={[styles.arrow, styles.dangerText]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutBox}>
            <Text style={styles.aboutText}>
              Sapy is an AI-powered chatbot that works completely offline on your device. All your conversations are private and encrypted.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.logoutButton,
              loading && styles.logoutButtonDisabled,
            ]}
            onPress={handleLogout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ff3b30" />
            ) : (
              <Text style={styles.logoutButtonText}>Logout</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingVertical: 20,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: 12,
  },
  subscriptionCard: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  subscriptionCardPremium: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFD700',
  },
  subscriptionTier: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 4,
  },
  subscriptionDesc: {
    fontSize: 12,
    color: '#718096',
  },
  subscriptionExpiry: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: '500',
  },
  settingItem: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingButton: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A202C',
  },
  settingValue: {
    fontSize: 14,
    color: '#8E92A9',
  },
  arrow: {
    fontSize: 20,
    color: '#8E92A9',
  },
  dangerText: {
    color: '#ff3b30',
  },
  aboutBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
  },
  aboutText: {
    fontSize: 13,
    color: '#8E92A9',
    lineHeight: 20,
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default SettingsScreen;
