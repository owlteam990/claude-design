import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageEntry } from '../types/session'

const {
  sendMock,
  getMemberBySessionIdMock,
  sendMessageToMemberMock,
  handleTeamCreatedMock,
  handleTeamUpdateMock,
  handleTeamDeletedMock,
} = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getMemberBySessionIdMock: vi.fn<(sessionId: string) => any>(() => null),
  sendMessageToMemberMock: vi.fn(async () => {}),
  handleTeamCreatedMock: vi.fn(),
  handleTeamUpdateMock: vi.fn(),
  handleTeamDeletedMock: vi.fn(),
}))

vi.mock('../api/websocket', () => ({
  wsManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    clearHandlers: vi.fn(),
    send: sendMock,
  },
}))

vi.mock('../api/sessions', () => ({
  sessionsApi: {
    getMessages: vi.fn(async () => ({ messages: [] })),
    getSlashCommands: vi.fn(async () => ({ commands: [] })),
  },
}))

vi.mock('./teamStore', () => ({
  useTeamStore: {
    getState: () => ({
      getMemberBySessionId: getMemberBySessionIdMock,
      sendMessageToMember: sendMessageToMemberMock,
      handleTeamCreated: handleTeamCreatedMock,
      handleTeamUpdate: handleTeamUpdateMock,
      handleTeamDeleted: handleTeamDeletedMock,
    }),
  },
}))

vi.mock('./tabStore', () => ({
  useTabStore: {
    getState: () => ({
      updateTabStatus: vi.fn(),
      updateTabTitle: vi.fn(),
    }),
  },
}))

vi.mock('./sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      updateSessionTitle: vi.fn(),
    }),
  },
}))

vi.mock('./cliTaskStore', () => ({
  useCLITaskStore: {
    getState: () => ({
      fetchSessionTasks: vi.fn(),
      tasks: [],
      clearTasks: vi.fn(),
      setTasksFromTodos: vi.fn(),
      markCompletedAndDismissed: vi.fn(),
      refreshTasks: vi.fn(),
    }),
  },
}))

import { mapHistoryMessagesToUiMessages, useChatStore } from './chatStore'

const TEST_SESSION_ID = 'test-session-1'
const initialState = useChatStore.getState()

describe('chatStore history mapping', () => {
  beforeEach(() => {
    sendMock.mockReset()
    getMemberBySessionIdMock.mockReset()
    getMemberBySessionIdMock.mockReturnValue(null)
    sendMessageToMemberMock.mockReset()
    useChatStore.setState({
      ...initialState,
      sessions: {},
    })
  })

  it('preserves thinking blocks when restoring transcript history', () => {
    const messages: MessageEntry[] = [
      {
        id: 'assistant-1',
        type: 'assistant',
        timestamp: '2026-04-06T00:00:00.000Z',
        model: 'opus',
        parentToolUseId: 'agent-1',
        content: [
          { type: 'thinking', thinking: 'internal reasoning' },
          { type: 'text', text: '目录结构分析' },
          { type: 'tool_use', name: 'Read', id: 'tool-1', input: { file_path: 'src/App.tsx' } },
        ],
      },
      {
        id: 'user-1',
        type: 'user',
        timestamp: '2026-04-06T00:00:01.000Z',
        parentToolUseId: 'agent-1',
        content: [
          { type: 'tool_result', tool_use_id: 'tool-1', content: 'ok', is_error: false },
        ],
      },
    ]

    const mapped = mapHistoryMessagesToUiMessages(messages)

    expect(mapped.map((message) => message.type)).toEqual([
      'thinking',
      'assistant_text',
      'tool_use',
      'tool_result',
    ])
    expect(mapped[2]).toMatchObject({ parentToolUseId: 'agent-1' })
    expect(mapped[3]).toMatchObject({ parentToolUseId: 'agent-1' })
  })

  it('surfaces teammate prompt content when mapping member transcript history', () => {
    const messages: MessageEntry[] = [
      {
        id: 'user-1',
        type: 'user',
        timestamp: '2026-04-06T00:00:00.000Z',
        content: '<teammate-message teammate_id="security-reviewer">Review the auth diff and call out risks.</teammate-message>',
      },
    ]

    const mapped = mapHistoryMessagesToUiMessages(messages, {
      includeTeammateMessages: true,
    })

    expect(mapped).toMatchObject([
      {
        type: 'user_text',
        content: 'Review the auth diff and call out risks.',
      },
    ])
  })

  it('keeps parent tool linkage for live tool events', () => {
    // Initialize the session first
    useChatStore.setState({
      sessions: {
        [TEST_SESSION_ID]: {
          messages: [],
          chatState: 'idle',
          connectionState: 'connected',
          streamingText: '',
          streamingToolInput: '',
          activeToolUseId: null,
          activeToolName: null,
          activeThinkingId: null,
          pendingPermission: null,
          tokenUsage: { input_tokens: 0, output_tokens: 0 },
          elapsedSeconds: 0,
          statusVerb: '',
          slashCommands: [],
          agentTaskNotifications: {},
          elapsedTimer: null,
        },
      },
    })

    useChatStore.getState().handleServerMessage(TEST_SESSION_ID, {
      type: 'tool_use_complete',
      toolName: 'Read',
      toolUseId: 'tool-1',
      input: { file_path: 'src/App.tsx' },
      parentToolUseId: 'agent-1',
    })

    useChatStore.getState().handleServerMessage(TEST_SESSION_ID, {
      type: 'tool_result',
      toolUseId: 'tool-1',
      content: 'ok',
      isError: false,
      parentToolUseId: 'agent-1',
    })

    expect(useChatStore.getState().sessions[TEST_SESSION_ID]?.messages).toMatchObject([
      {
        type: 'tool_use',
        toolUseId: 'tool-1',
        parentToolUseId: 'agent-1',
      },
      {
        type: 'tool_result',
        toolUseId: 'tool-1',
        parentToolUseId: 'agent-1',
      },
    ])
  })

  it('sends permission mode updates to the active session only', () => {
    useChatStore.getState().setSessionPermissionMode('nonexistent-session', 'acceptEdits')
    expect(sendMock).not.toHaveBeenCalled()

    useChatStore.setState({
      sessions: {
        'session-1': {
          messages: [],
          chatState: 'idle',
          connectionState: 'connected',
          streamingText: '',
          streamingToolInput: '',
          activeToolUseId: null,
          activeToolName: null,
          activeThinkingId: null,
          pendingPermission: null,
          tokenUsage: { input_tokens: 0, output_tokens: 0 },
          elapsedSeconds: 0,
          statusVerb: '',
          slashCommands: [],
          agentTaskNotifications: {},
          elapsedTimer: null,
        },
      },
    })
    useChatStore.getState().setSessionPermissionMode('session-1', 'acceptEdits')

    expect(sendMock).toHaveBeenCalledWith('session-1', {
      type: 'set_permission_mode',
      mode: 'acceptEdits',
    })
  })

  it('stores terminal task notifications for agent tool cards', () => {
    useChatStore.setState({
      sessions: {
        [TEST_SESSION_ID]: {
          messages: [],
          chatState: 'idle',
          connectionState: 'connected',
          streamingText: '',
          streamingToolInput: '',
          activeToolUseId: null,
          activeToolName: null,
          activeThinkingId: null,
          pendingPermission: null,
          tokenUsage: { input_tokens: 0, output_tokens: 0 },
          elapsedSeconds: 0,
          statusVerb: '',
          slashCommands: [],
          agentTaskNotifications: {},
          elapsedTimer: null,
        },
      },
    })

    useChatStore.getState().handleServerMessage(TEST_SESSION_ID, {
      type: 'system_notification',
      subtype: 'task_notification',
      data: {
        task_id: 'agent-task-1',
        tool_use_id: 'agent-tool-1',
        status: 'completed',
        summary: 'Agent "修复异常处理" completed',
        output_file: '/tmp/agent-output.txt',
      },
    })

    expect(
      useChatStore.getState().sessions[TEST_SESSION_ID]?.agentTaskNotifications[
        'agent-tool-1'
      ],
    ).toMatchObject({
      taskId: 'agent-task-1',
      toolUseId: 'agent-tool-1',
      status: 'completed',
      summary: 'Agent "修复异常处理" completed',
      outputFile: '/tmp/agent-output.txt',
    })
  })

  it('flushes the previous assistant draft before starting a new user turn', () => {
    useChatStore.setState({
      sessions: {
        [TEST_SESSION_ID]: {
          messages: [],
          chatState: 'streaming',
          connectionState: 'connected',
          streamingText: '上一次分析结果 **还在流式区域**',
          streamingToolInput: '',
          activeToolUseId: null,
          activeToolName: null,
          activeThinkingId: null,
          pendingPermission: null,
          tokenUsage: { input_tokens: 0, output_tokens: 0 },
          elapsedSeconds: 0,
          statusVerb: '',
          slashCommands: [],
          agentTaskNotifications: {},
          elapsedTimer: null,
        },
      },
    })

    useChatStore.getState().sendMessage(TEST_SESSION_ID, '你是什么模型？')

    expect(useChatStore.getState().sessions[TEST_SESSION_ID]?.messages).toMatchObject([
      {
        type: 'assistant_text',
        content: '上一次分析结果 **还在流式区域**',
      },
      {
        type: 'user_text',
        content: '你是什么模型？',
      },
    ])
    expect(useChatStore.getState().sessions[TEST_SESSION_ID]?.streamingText).toBe('')
  })

  it('routes member-session messages through team mailbox delivery instead of websocket', async () => {
    const memberSessionId = 'team-member:security-reviewer@test-team'
    getMemberBySessionIdMock.mockReturnValue({
      agentId: 'security-reviewer@test-team',
      role: 'security-reviewer',
      status: 'running',
    })

    useChatStore.setState({
      sessions: {
        [memberSessionId]: {
          messages: [],
          chatState: 'idle',
          connectionState: 'connected',
          streamingText: '',
          streamingToolInput: '',
          activeToolUseId: null,
          activeToolName: null,
          activeThinkingId: null,
          pendingPermission: null,
          tokenUsage: { input_tokens: 0, output_tokens: 0 },
          elapsedSeconds: 0,
          statusVerb: '',
          slashCommands: [],
          agentTaskNotifications: {},
          elapsedTimer: null,
        },
      },
    })

    useChatStore.getState().sendMessage(memberSessionId, 'Check the latest regression')
    await Promise.resolve()

    expect(sendMessageToMemberMock).toHaveBeenCalledWith(
      memberSessionId,
      'Check the latest regression',
    )
    expect(sendMock).not.toHaveBeenCalled()
    const sessionMessages = useChatStore.getState().sessions[memberSessionId]?.messages ?? []

    expect(sessionMessages[sessionMessages.length - 1]).toMatchObject({
      type: 'user_text',
      content: 'Check the latest regression',
      pending: true,
    })
  })
})
