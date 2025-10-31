import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server-helpers'
import { getChatConversations, createChatConversation, getChatConversation } from '@/lib/api/chat'

// Get the most recent conversation or create a new one
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get most recent conversation for this team and user
    const conversations = await getChatConversations(teamId, userId)
    
    if (conversations.length > 0) {
      // Return the most recent conversation with messages
      const conversationId = conversations[0].id
      const conversation = await getChatConversation(conversationId)
      return NextResponse.json(conversation || null)
    }

    // No conversation exists, return null
    return NextResponse.json(null)
  } catch (error) {
    console.error('Error fetching active conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active conversation' },
      { status: 500 }
    )
  }
}

// Create a new conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversation = await createChatConversation({
      teamId,
      userId,
    })

    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}

