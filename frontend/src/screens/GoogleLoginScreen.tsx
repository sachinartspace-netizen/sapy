import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { api } from '../api/client';

type Props = NativeStackScreenProps<AuthStackParamList, 'GoogleLogin'>;

const GoogleLoginScreen = ({ navigation }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      // In production, use Expo Google Sign-In
      // For now, show instructions
      Alert.alert(
        'Google Sign-In',
        'In production, this will use Google OAuth.\n\nFor development, click "Continue" to use test account.',
        [
          {
            text: 'Cancel',
            onPress: () => setLoading(false),
            style: 'cancel',
          },
          {
            text: 'Continue',
            onPress: async () => {
              try {
                // Simulate Google OAuth login
                const response = await api.loginWithGoogle({
                  token: 'test-google-token',
                  name: 'Test User',
                  email: 'test@example.com',
                });

                if (response.access_token) {
                  // Token will be stored automatically by api client
                  // Navigation will happen automatically via App.tsx
                }
              } catch (error: any) {
                Alert.alert('Login Failed', error.message);
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.title}>Sign in with Google</Text>
            <Text style={styles.subtitle}>
              Use your Google account to quickly access Sapy
            </Text>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🔐</Text>
              <Text style={styles.infoText}>
                We only access your basic profile information
              </Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>🚀</Text>
              <Text style={styles.infoText}>
                Fast and secure login with Google
              </Text>
            </View>
          </View>

          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.googleLogo}>G</Text>
                  <Text style={styles.loginButtonText}>
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.alternativeButton}
              onPress={() => navigation.navigate('PhoneOTP')}
            >
              <Text style={styles.alternativeButtonText}>
                Don't have a Google account? Use Phone
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flexContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'flex-start',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0066FF',
    fontWeight: '600',
  },
  headerSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A202C',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E92A9',
    lineHeight: 20,
  },
  infoSection: {
    marginBottom: 40,
    gap: 12,
  },
  infoBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#8E92A9',
    flex: 1,
    lineHeight: 16,
  },
  buttonSection: {
    gap: 12,
    marginTop: 'auto',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#0066FF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  googleLogo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 10,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  alternativeButton: {
    paddingVertical: 12,
  },
  alternativeButtonText: {
    fontSize: 14,
    color: '#0066FF',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default GoogleLoginScreen;
