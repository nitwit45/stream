import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb-client';
import { hashPassword } from '@/lib/auth/password';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const users = client.db().collection('users');

    const existing = await users.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    await users.insertOne({
      email: normalizedEmail,
      name: typeof name === 'string' && name.trim() ? name.trim() : null,
      image: null,
      emailVerified: null,
      passwordHash,
      createdAt: now,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
