import React from 'react';
import {
  View,
  StyleSheet,
  Text,
} from 'react-native';
import { Message } from '../types';
import CodeBlock from './CodeBlock';
import { parseContentWithCodeBlocks, normalizeLanguage } from '../utils/codeBlockParser';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.sender_type === 'user';
  const parsedContent = parseContentWithCodeBlocks(message.content);

  const renderContent = () => {
    // If no code blocks, just render text
    if (parsedContent.length === 1 && parsedContent[0].type === 'text') {
      return (
        <Text
          style={[
            styles.text,
            isUser ? styles.userText : styles.aiText,
          ]}
        >
          {message.content}
        </Text>
      );
    }

    // Render mixed content (text + code blocks)
    return (
      <View style={styles.mixedContent}>
        {parsedContent.map((segment, index) => {
          if (segment.type === 'text') {
            return (
              <Text
                key={index}
                style={[
                  styles.text,
                  isUser ? styles.userText : styles.aiText,
                ]}
              >
                {segment.content}
              </Text>
            );
          } else {
            // Code block
            return (
              <View key={index} style={styles.codeBlockContainer}>
                <CodeBlock
                  language={normalizeLanguage(segment.language || 'code')}
                  code={segment.content}
                />
              </View>
            );
          }
        })}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        {renderContent()}
      </View>
      <Text style={styles.timestamp}>
        {message.created_at
          ? new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '90%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  userBubble: {
    backgroundColor: '#0066FF',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#F5F7FA',
    borderBottomLeftRadius: 4,
  },
  mixedContent: {
    gap: 8,
  },
  codeBlockContainer: {
    marginVertical: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#1A202C',
  },
  timestamp: {
    fontSize: 11,
    color: '#C5CAD1',
    marginHorizontal: 8,
  },
});
