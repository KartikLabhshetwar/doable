# Doable

A modern task management platform with AI-powered assistance.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![Better Auth](https://img.shields.io/badge/Better%20Auth-1.3.32-blue)
![Groq](https://img.shields.io/badge/Groq-0.34.0-blue)
![Resend](https://img.shields.io/badge/Resend-6.3.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.1-blue)
![Shadcn/ui](https://img.shields.io/badge/Shadcn/ui-1.15.15-blue)

## Overview

Doable is a modern, AI-powered task management platform designed for teams who want to ship faster and work smarter. Built with Next.js 15, React 19, and TypeScript, Doable combines the power of AI assistance with intuitive project management tools.

**What makes Doable different:**

- Natural language AI assistant powered by GPT-OSS 120B for intelligent task management
- Seamless team collaboration with role-based access control
- Flexible workflows that adapt to your team's process
- Beautiful, distraction-free interface focused on getting things done
- Self-hosted option with Bring Your Own API Key (BYOK) support

## Features

- **AI Assistant** - Natural language task management powered by Groq's GPT-OSS 120B model. Create, update, and manage tasks through conversation
- **Project & Issue Management** - Organize work into projects with custom workflows, priorities, and estimates
- **Team Collaboration** - Invite team members, assign tasks, and collaborate effectively
- **Modern Design** - Clean, intuitive interface inspired by Swiss design principles
- **Custom Workflows** - Define your own workflow states (Backlog, Todo, In Progress, Done, etc.)
- **Labeling System** - Categorize issues with custom labels and colors
- **AI Chat History** - Persistent conversation history for each team
- **BYOK Support** - Bring your own Groq API key for per-team AI access
- **Real-time Updates** - Instant UI updates after AI assistant actions
- **Secure** - Google OAuth authentication via Better Auth with session management
- **Fast & Lightweight** - Built with Next.js 15 and optimized for performance

## Architecture

### Database Schema

The application uses PostgreSQL with Prisma ORM. The main entities are:

- **Team** - Top-level workspace organization
- **Project** - Project containers within teams
- **Issue** - Task items with priority, status, and estimates
- **WorkflowState** - Custom workflow states (backlog, todo, in progress, etc.)
- **Label** - Categorization tags for issues
- **TeamMember** - User-team relationships with roles
- **Invitation** - Pending team invitations via email
- **ChatConversation** - AI chatbot conversation history
- **ChatMessage** - Individual messages in conversations

### API Routes

- `/api/auth/*` - Better Auth authentication handlers
- `/api/teams/*` - Team management and CRUD operations
- `/api/teams/[teamId]/issues/*` - Issue management
- `/api/teams/[teamId]/projects/*` - Project management
- `/api/teams/[teamId]/chat` - AI chatbot endpoint with streaming
- `/api/teams/[teamId]/invitations/*` - Team invitation system
- `/api/invitations/[invitationId]` - Public invitation details

### AI Chatbot

The chatbot is powered by Vercel AI SDK with Groq using the GPT-OSS (Open Source GPT) 120B model. It uses function calling for:

- **Creating and updating issues** - Natural language task creation with automatic field resolution
- **Managing projects** - Create, update, and manage project containers
- **Inviting team members** - Send team invitations via email
- **Retrieving team statistics** - Get overview of team activity and metrics
- **Listing and filtering issues** - Query and display tasks with various filters
- **Getting issue details** - Retrieve complete information about specific tasks

**Key Features:**

- Natural language understanding for project management commands
- Automatic resolution of names to IDs (workflow states, assignees, projects, labels)
- Multi-step tool execution capability
- Conversation history persistence in database
- Streaming responses for real-time interaction
- Team-specific API key support (BYOK - Bring Your Own Key)

Chat history is persisted in the database for each conversation, allowing users to resume previous discussions.

### Authentication

- Better Auth with Google OAuth
- Session management with 7-day expiration
- Cookie-based authentication
- Automatic session refresh

## Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- Google Cloud OAuth credentials
- Groq API key (optional, for AI features)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/KartikLabhshetwar/doable.git
   cd doable
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables

   Create a `.env.local` file with the following variables:

   **Required:**
   ```env
   # Better Auth Configuration
   BETTER_AUTH_SECRET="generate-with-openssl-rand-base64-32"
   BETTER_AUTH_URL="http://localhost:3000"
   
   # Database Connection
   DATABASE_URL="postgresql://user:password@localhost:5432/doable"
   
   # Google OAuth Credentials
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   
   # Application URL
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

   **Optional:**
   ```env
   # AI Chatbot (Get free API key from https://console.groq.com)
   # Note: You can also set this per-team using the API key dialog in team settings
   GROQ_API_KEY="your-groq-api-key"
   
   # Email Service (For team invitations via Resend)
   RESEND_API_KEY="your-resend-api-key"
   RESEND_FROM_EMAIL="noreply@yourdomain.com"
   ```

   Generate the auth secret:
   ```bash
   openssl rand -base64 32
   ```

4. Set up the database
   ```bash
   npx prisma db push
   npx @better-auth/cli generate
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

6. Open your browser

   Navigate to <http://localhost:3000>

## Environment Variables

### Required Variables

- `BETTER_AUTH_SECRET` - Secret key for Better Auth session encryption
- `BETTER_AUTH_URL` - Base URL for Better Auth (e.g., <http://localhost:3000>)
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXT_PUBLIC_APP_URL` - Public-facing application URL

### Optional Variables

- `GROQ_API_KEY` - Groq API key for AI chatbot features. Get a free key at <https://console.groq.com>. This is a global fallback - teams can also configure their own API keys in team settings.
- `RESEND_API_KEY` - Resend API key for sending team invitation emails. Get your key at <https://resend.com>
- `RESEND_FROM_EMAIL` - Verified sender email address for Resend (defaults to noreply@doable.kartiklabhshetwar.me)

### AI Features Setup

1. **Get a Groq API Key:**
   - Visit [console.groq.com](https://console.groq.com/)
   - Sign up for a free account
   - Generate a new API key from the API Keys section
   - Copy the key (starts with `gsk_`)

2. **Configure API Key:**
   - Option 1: Add to `.env.local` as `GROQ_API_KEY` (applies to all teams)
   - Option 2: Set per-team in Team Settings → Manage API Key (recommended for multi-tenant setups)

3. **Start Using AI:**
   - Navigate to any team's dashboard
   - Open the AI Chatbot interface
   - Start chatting with natural language commands like:
     - "Create a new issue for fixing the login bug"
     - "Show me all high-priority issues"
     - "Update the checkout page issue to In Progress and assign it to John"

### Google OAuth Setup

1. Go to Google Cloud Console
2. Create a new project or select existing
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to your .env.local file

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **UI**: React 19
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth with Google OAuth
- **AI**: Vercel AI SDK with Groq (GPT-OSS 120B)
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Shadcn/ui and Radix UI
- **Email**: Resend for team invitations
- **Drag & Drop**: Hello Pangea DnD
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation

## Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database Management

```bash
npx prisma db push      # Push schema changes to database
npx prisma generate     # Generate Prisma Client
npx prisma studio       # Open Prisma Studio for database browsing
```

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
