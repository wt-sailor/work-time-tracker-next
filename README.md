# Work Time Tracker

A modern time tracking application built with Next.js, Prisma, and NextAuth. Track your work hours, manage worklogs, and visualize your productivity with an interactive calendar.

## Features

- ⏱️ **Work Timer** - Track your work hours with a built-in timer
- 📊 **Dashboard** - View your productivity statistics at a glance
- 📅 **Calendar View** - Visualize your worklogs on an interactive calendar
- 🔐 **Authentication** - Secure user authentication with NextAuth
- 🔄 **Timer Sync** - Sync your timer data across devices
- 📝 **Worklog Management** - Create, edit, and delete worklog entries

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js
- **Calendar**: FullCalendar
- **Language**: TypeScript

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18.x or later
- npm, yarn, pnpm, or bun

## Installation

1. Clone the repository:

```
bash
git clone <repository-url>
cd work-time-tracker-next
```

2. Install dependencies:

```
bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Set up the database:

```
bash
npx prisma migrate dev
```

## Running the Development Server

Start the development server:

```
bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Building for Production

Build the application for production:

```
bash
npm run build
# or
yarn build
# or
pnpm build
# or
bun build
```

Start the production server:

```
bash
npm start
# or
yarn start
# or
pnpm start
# or
bun start
```

## Project Structure

```
work-time-tracker-next/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/       # Database migrations
├── public/               # Static assets
├── scripts/              # Deployment scripts
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes
│   │   ├── calendar/     # Calendar page
│   │   ├── dashboard/    # Dashboard page
│   │   ├── login/        # Login page
│   │   └── register/     # Registration page
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   └── types/            # TypeScript type definitions
├── docker-compose.yml    # Docker configuration
├── Dockerfile            # Docker image definition
├── eslint.config.mjs     # ESLint configuration
├── next.config.ts        # Next.js configuration
├── package.json          # Project dependencies
├── postcss.config.mjs    # PostCSS configuration
├── prisma.config.ts     # Prisma configuration
└── tsconfig.json        # TypeScript configuration
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org)
- [Prisma](https://www.prisma.io)
- [NextAuth.js](https://next-auth.js.org)
- [Tailwind CSS](https://tailwindcss.com)
- [FullCalendar](https://fullcalendar.io)
