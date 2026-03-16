import React, { useState, useEffect } from 'react';
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
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { api } from '../api/client';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneOTP'>;

const PhoneOTPScreen = ({ navigation }: Props) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [requestId, setRequestId] = useState<string>('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdownSeconds > 0) {
      timer = setInterval(() => {
        setCountdownSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdownSeconds]);

  const handlePhoneSubmit = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    // Normalize phone number to E.164 format
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone;
    }

    try {
      setLoading(true);
      const response = await api.requestPhoneOtp({
        phone_number: normalizedPhone,
      });

      setRequestId(response.request_id);
      setStep('otp');
      setCountdownSeconds(60); // 60 second countdown
      Alert.alert('Success', 'OTP sent to your phone');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!otp.trim() || otp.length < 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await api.verifyPhoneOtp({
        request_id: requestId,
        otp_code: otp,
      });

      if (response.access_token) {
        // Token will be stored automatically by api client
        // Navigation will happen automatically via App.tsx
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    setOtp('');
    setCountdownSeconds(0);
    handlePhoneSubmit();
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
            onPress={() => {
              if (step === 'otp') {
                setStep('phone');
                setOtp('');
              } else {
                navigation.goBack();
              }
            }}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {step === 'phone' ? (
            <PhoneInputStep
              phone={phone}
              setPhone={setPhone}
              loading={loading}
              onSubmit={handlePhoneSubmit}
              onGoogleLogin={() => navigation.navigate('GoogleLogin')}
            />
          ) : (
            <OTPInputStep
              otp={otp}
              setOtp={setOtp}
              loading={loading}
              onSubmit={handleOtpSubmit}
              countdownSeconds={countdownSeconds}
              onResend={handleResendOtp}
              phone={phone}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

interface PhoneInputStepProps {
  phone: string;
  setPhone: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
  onGoogleLogin: () => void;
}

const PhoneInputStep = ({
  phone,
  setPhone,
  loading,
  onSubmit,
  onGoogleLogin,
}: PhoneInputStepProps) => (
  <>
    <View style={styles.headerSection}>
      <Text style={styles.title}>Enter Your Phone</Text>
      <Text style={styles.subtitle}>
        We'll send you an OTP to verify your number
      </Text>
    </View>

    <View style={styles.formSection}>
      <Text style={styles.label}>Phone Number</Text>
      <TextInput
        style={styles.input}
        placeholder="+91 XXXXX XXXXX"
        placeholderTextColor="#C5CAD1"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        editable={!loading}
      />
      <Text style={styles.helperText}>
        Include country code (e.g., +91 for India)
      </Text>
    </View>

    <View style={styles.buttonSection}>
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Send OTP</Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={onGoogleLogin}
      >
        <Text style={styles.googleLogo}>G</Text>
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  </>
);

interface OTPInputStepProps {
  otp: string;
  setOtp: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
  countdownSeconds: number;
  onResend: () => void;
  phone: string;
}

const OTPInputStep = ({
  otp,
  setOtp,
  loading,
  onSubmit,
  countdownSeconds,
  onResend,
  phone,
}: OTPInputStepProps) => (
  <>
    <View style={styles.headerSection}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        We sent a code to {phone}
      </Text>
    </View>

    <View style={styles.formSection}>
      <Text style={styles.label}>One-Time Password</Text>
      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor="#C5CAD1"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
        editable={!loading}
      />
      <Text style={styles.helperText}>Enter the 6-digit code</Text>
    </View>

    <View style={styles.buttonSection}>
      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.resendButton,
          countdownSeconds > 0 && styles.resendButtonDisabled,
        ]}
        onPress={onResend}
        disabled={countdownSeconds > 0}
      >
        <Text style={styles.resendButtonText}>
          {countdownSeconds > 0
            ? `Resend OTP in ${countdownSeconds}s`
            : 'Resend OTP'}
        </Text>
      </TouchableOpacity>
    </View>
  </>
);

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
  formSection: {
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A202C',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#8E92A9',
  },
  buttonSection: {
    gap: 12,
    marginTop: 'auto',
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#0066FF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resendButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#0066FF',
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#8E92A9',
    fontSize: 12,
  },
  googleButton: {
    borderWidth: 2,
    borderColor: '#0066FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066FF',
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066FF',
  },
});

export default PhoneOTPScreen;
