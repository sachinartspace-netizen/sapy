import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const OnboardingScreen = ({ navigation }: Props) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoSection}>
          <Image
            source={require('../../assets/sapy-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Sapy</Text>
          <Text style={styles.tagline}>Your AI Chatbot Companion</Text>
        </View>

        <View style={styles.featureSection}>
          <View style={styles.featureBox}>
            <Text style={styles.featureIcon}>🤖</Text>
            <Text style={styles.featureTitle}>Smart AI</Text>
            <Text style={styles.featureDesc}>
              Powered by advanced AI models
            </Text>
          </View>

          <View style={styles.featureBox}>
            <Text style={styles.featureIcon}>🔒</Text>
            <Text style={styles.featureTitle}>Private & Secure</Text>
            <Text style={styles.featureDesc}>
              All conversations are encrypted
            </Text>
          </View>

          <View style={styles.featureBox}>
            <Text style={styles.featureIcon}>📱</Text>
            <Text style={styles.featureTitle}>Works Offline</Text>
            <Text style={styles.featureDesc}>
              Use Sapy even without internet
            </Text>
          </View>
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => navigation.navigate('GoogleLogin')}
            activeOpacity={0.7}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.phoneButton}
            onPress={() => navigation.navigate('PhoneOTP')}
            activeOpacity={0.7}
          >
            <Text style={styles.phoneIcon}>📱</Text>
            <Text style={styles.buttonText}>Continue with Phone</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0066FF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#8E92A9',
    textAlign: 'center',
  },
  featureSection: {
    marginBottom: 40,
  },
  featureBox: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    color: '#8E92A9',
    textAlign: 'center',
  },
  buttonSection: {
    gap: 12,
    marginBottom: 20,
  },
  googleButton: {
    backgroundColor: '#0066FF',
    borderRadius: 12,
    paddingVertical: 14,
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
  phoneButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0066FF',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
    color: '#fff',
  },
  phoneIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066FF',
  },
  termsSection: {
    marginTop: 20,
  },
  termsText: {
    fontSize: 11,
    color: '#8E92A9',
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: {
    color: '#0066FF',
    fontWeight: '600',
  },
});

export default OnboardingScreen;
