import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock = ({ language, code }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Error copying code:', error);
      Alert.alert('Error', 'Failed to copy code');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.language}>{language || 'code'}</Text>
        <TouchableOpacity
          style={[styles.copyButton, copied && styles.copyButtonSuccess]}
          onPress={handleCopyCode}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy'}
            size={16}
            color={copied ? '#4CAF50' : '#0066FF'}
          />
          <Text style={[styles.copyText, copied && styles.copyTextSuccess]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.codeContent}
        scrollEnabled={true}
        horizontal={true}
      >
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    backgroundColor: '#252526',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  language: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'lowercase',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F7FF',
  },
  copyButtonSuccess: {
    backgroundColor: '#E8F5E9',
  },
  copyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066FF',
  },
  copyTextSuccess: {
    color: '#4CAF50',
  },
  codeContent: {
    maxHeight: 300,
    backgroundColor: '#1E1E1E',
  },
  codeText: {
    fontSize: 13,
    fontFamily: 'Menlo',
    color: '#D4D4D4',
    padding: 12,
    lineHeight: 18,
  },
});

export default CodeBlock;
