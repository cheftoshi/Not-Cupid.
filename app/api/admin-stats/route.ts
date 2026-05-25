import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { data: users } = await supabaseAdmin.from('users').select('*').order('created_at', { ascending: false })
    const { data: matches } = await supabaseAdmin.from('matches').select('*').order('created_at', { ascending: false })
    const { data: unlocks } = await supabaseAdmin.from('unlocks').select('*')

    const totalUsers = users?.length ?? 0
    const totalMatches = matches?.length ?? 0
    const totalRevenue = (unlocks?.length ?? 0) * 0.99
    const pendingMatches = matches?.filter(m => m.status === 'pending').length ?? 0
    const bothAccepted = matches?.filter(m => m.status === 'both_accepted').length ?? 0
    const passed = matches?.filter(m => m.status === 'passed').length ?? 0
    const waiting = users?.filter(u => u.status === 'waiting').length ?? 0
    const matched = users?.filter(u => u.status === 'matched').length ?? 0
    const men = users?.filter(u => u.gender === 'm').length ?? 0
    const women = users?.filter(u => u.gender === 'f').length ?? 0
    const bi = users?.filter(u => u.gender === 'b').length ?? 0

    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days[d.toISOString().split('T')[0]] = 0
    }
    users?.forEach(u => {
      const day = u.created_at?.split('T')[0]
      if (day && days[day] !== undefined) days[day]++
    })

    const recentUsers = users?.slice(0, 15).map(u => ({
      name: u.name, email: u.email, gender: u.gender,
      seeking: u.seeking, zip: u.zip, status: u.status, created_at: u.created_at
    }))

    const recentMatches = matches?.slice(0, 15).map(m => ({
      id: m.id, score: m.compatibility_score, status: m.status,
      user1_accepted: m.user_1_accepted, user2_accepted: m.user_2_accepted, created_at: m.created_at
    }))

    return NextResponse.json({
      stats: { totalUsers, totalMatches, totalRevenue: totalRevenue.toFixed(2), pendingMatches, bothAccepted, passed, waiting, matched, men, women, bi },
      signupsPerDay: days,
      recentUsers,
      recentMatches,
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
