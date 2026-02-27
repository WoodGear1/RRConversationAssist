import NextAuth, { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const result = await pool.query(
          'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
          [credentials.email]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const user = result.rows[0];

        if (!user.is_active) {
          return null;
        }

        if (!user.password_hash) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password_hash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'discord' && account?.providerAccountId) {
        // Find or create user
        const userResult = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [user.email]
        );

        let userId: string;
        if (userResult.rows.length === 0) {
          // Create new user
          const insertResult = await pool.query(
            'INSERT INTO users (email, role) VALUES ($1, $2) RETURNING id',
            [user.email, 'user']
          );
          userId = insertResult.rows[0].id;
        } else {
          userId = userResult.rows[0].id;
        }

        // Link Discord account
        await pool.query(
          `INSERT INTO user_discord_links (user_id, discord_user_id, discord_username, discord_avatar)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (discord_user_id) 
           DO UPDATE SET discord_username = $3, discord_avatar = $4, updated_at = CURRENT_TIMESTAMP`,
          [
            userId,
            account.providerAccountId,
            profile?.username || null,
            profile?.image || null,
          ]
        );
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const userResult = await pool.query(
          'SELECT id, role FROM users WHERE email = $1',
          [session.user.email]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          session.user.id = user.id;
          session.user.role = user.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
