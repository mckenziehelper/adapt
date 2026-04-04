import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'
import { getActiveProgram, updateProgram } from '../../lib/programs'
import { supabase } from '../../lib/supabase'
import { ProgramModel } from '../../lib/watermelon'

type Message = {
  role: 'user' | 'assistant'
  content: string
  proposedProgram?: object
}

export default function CoachChatScreen() {
  const [programRecord, setProgramRecord] = useState<ProgramModel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useFocusEffect(
    useCallback(() => {
      getActiveProgram().then(setProgramRecord)
    }, [])
  )

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length, loading])

  async function sendMessage() {
    if (!input.trim() || !programRecord || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('coach-chat', {
        body: {
          current_program: programRecord.program,
          conversation: messages.map((m) => ({ role: m.role, content: m.content })),
          user_message: userMessage,
        },
      })

      if (error) throw error

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message || 'Something went wrong — try again.',
          proposedProgram: data.program_changes,
        },
      ])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Couldn't reach the coach right now. Check your connection and try again.`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function applyChanges(proposedProgram: object) {
    if (!programRecord) return
    setApplying(true)
    await updateProgram(programRecord.id, proposedProgram)
    const updated = await getActiveProgram()
    setProgramRecord(updated)
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'Done — your program has been updated.' },
    ])
    setApplying(false)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Coach Chat</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContainer}
        >
          {/* Welcome message */}
          {messages.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Your AI Coach</Text>
              <Text style={styles.emptySubtitle}>
                Tell me what you'd like to change about your program. I can adjust exercises,
                sets, reps, weights, progressions, or anything else.
              </Text>
              <View style={styles.suggestions}>
                {[
                  'Add more upper body volume',
                  'Replace squats with leg press',
                  'Increase bench press frequency',
                  'Make it easier on my lower back',
                ].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestion}
                    onPress={() => setInput(s)}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((msg, idx) => (
            <ChatBubble
              key={idx}
              message={msg}
              onApply={applyChanges}
              applying={applying}
            />
          ))}

          {loading && <TypingIndicator />}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.text} size="small" />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ChatBubble({
  message,
  onApply,
  applying,
}: {
  message: Message
  onApply: (program: object) => void
  applying: boolean
}) {
  const isUser = message.role === 'user'
  return (
    <View style={[styles.bubbleWrap, isUser && styles.bubbleWrapUser]}>
      {!isUser && <Text style={styles.bubbleRole}>Coach</Text>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={styles.bubbleText}>{message.content}</Text>
      </View>
      {message.proposedProgram && (
        <TouchableOpacity
          style={[styles.applyBtn, applying && styles.applyBtnDisabled]}
          onPress={() => onApply(message.proposedProgram!)}
          disabled={applying}
        >
          {applying ? (
            <ActivityIndicator color={Colors.text} size="small" />
          ) : (
            <Text style={styles.applyBtnText}>Apply these changes →</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

function TypingIndicator() {
  return (
    <View style={styles.bubbleWrap}>
      <Text style={styles.bubbleRole}>Coach</Text>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
        <Text style={styles.typingDots}>• • •</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  backBtn: { width: 60, paddingVertical: 6 },
  backText: { color: Colors.accent, fontSize: 17 },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  messagesScroll: { flex: 1 },
  messagesContainer: { padding: Spacing.md, gap: 12, paddingBottom: 8 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: {
    color: Colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  suggestions: { gap: 8, width: '100%' },
  suggestion: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
  },
  suggestionText: { color: Colors.text, fontSize: 14 },

  // Bubbles
  bubbleWrap: { maxWidth: '85%', alignSelf: 'flex-start' },
  bubbleWrapUser: { alignSelf: 'flex-end' },
  bubbleRole: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginLeft: 2,
  },
  bubble: {
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: Colors.text, fontSize: 15, lineHeight: 21 },

  typingBubble: { paddingVertical: 14 },
  typingDots: { color: Colors.muted, fontSize: 16, letterSpacing: 4 },

  // Apply button
  applyBtn: {
    backgroundColor: Colors.success,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  applyBtnDisabled: { opacity: 0.6 },
  applyBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },

  // Input area
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
    gap: 8,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surface },
  sendBtnText: { color: Colors.text, fontSize: 20, fontWeight: '700' },
})
