import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Client for the calling user
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action, ...params } = await req.json()

    // Check caller's role
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin') ?? false

    // Check salon admin membership
    const { data: callerMemberships } = await supabaseAdmin
      .from('salon_members')
      .select('salon_id, role')
      .eq('user_id', user.id)

    const isSalonAdmin = (salonId: string) =>
      callerMemberships?.some(m => m.salon_id === salonId && m.role === 'salon_admin') ?? false

    switch (action) {
      // ─── Change own password ───
      case 'change_own_password': {
        const { new_password } = params
        if (!new_password || new_password.length < 6) {
          return new Response(JSON.stringify({ error: 'Şifre en az 6 karakter olmalıdır' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: new_password,
        })

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ success: true, message: 'Şifre başarıyla değiştirildi' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ─── Super admin resets any user's password ───
      case 'admin_reset_password': {
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ error: 'Yetkiniz yok' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { target_user_id, new_password } = params
        if (!target_user_id || !new_password || new_password.length < 6) {
          return new Response(JSON.stringify({ error: 'Geçersiz parametreler' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
          password: new_password,
        })

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ success: true, message: 'Şifre sıfırlandı' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ─── Salon admin resets staff password ───
      case 'salon_admin_reset_staff_password': {
        const { staff_user_id, salon_id, new_password } = params
        if (!staff_user_id || !salon_id || !new_password || new_password.length < 6) {
          return new Response(JSON.stringify({ error: 'Geçersiz parametreler' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!isSuperAdmin && !isSalonAdmin(salon_id)) {
          return new Response(JSON.stringify({ error: 'Bu salona yetkiniz yok' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Verify the target user is actually a member of this salon
        const { data: targetMembership } = await supabaseAdmin
          .from('salon_members')
          .select('id')
          .eq('user_id', staff_user_id)
          .eq('salon_id', salon_id)
          .single()

        if (!targetMembership) {
          return new Response(JSON.stringify({ error: 'Bu kullanıcı bu salona ait değil' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(staff_user_id, {
          password: new_password,
        })

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ success: true, message: 'Personel şifresi sıfırlandı' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ─── Super admin lists all users with their roles and salon memberships ───
      case 'list_users': {
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ error: 'Yetkiniz yok' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get roles and memberships
        const { data: allRoles } = await supabaseAdmin.from('user_roles').select('*')
        const { data: allMembers } = await supabaseAdmin.from('salon_members').select('*, salons(name)')
        const { data: allProfiles } = await supabaseAdmin.from('profiles').select('*')

        const enrichedUsers = users.map(u => {
          const roles = allRoles?.filter(r => r.user_id === u.id).map(r => r.role) ?? []
          const memberships = allMembers?.filter(m => m.user_id === u.id) ?? []
          const profile = allProfiles?.find(p => p.user_id === u.id)
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            full_name: profile?.full_name || u.user_metadata?.full_name || null,
            phone: profile?.phone || null,
            roles,
            memberships: memberships.map(m => ({
              salon_id: m.salon_id,
              salon_name: (m as any).salons?.name || '',
              role: m.role,
              branch_id: m.branch_id,
            })),
          }
        })

        return new Response(JSON.stringify({ users: enrichedUsers }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ─── Super admin creates a new user ───
      case 'create_user': {
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ error: 'Yetkiniz yok' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { email, password, full_name, role, salon_id: assignSalonId, salon_role } = params
        if (!email || !password || password.length < 6) {
          return new Response(JSON.stringify({ error: 'Email ve şifre (min 6 karakter) gerekli' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || email },
        })

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Assign role if specified
        if (role) {
          await supabaseAdmin.from('user_roles').insert({ user_id: newUser.user.id, role })
        }

        // Assign to salon if specified
        if (assignSalonId) {
          await supabaseAdmin.from('salon_members').insert({
            user_id: newUser.user.id,
            salon_id: assignSalonId,
            role: salon_role || 'staff',
          })
        }

        return new Response(JSON.stringify({ 
          success: true, 
          user_id: newUser.user.id,
          message: 'Kullanıcı başarıyla oluşturuldu' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ─── Super admin deletes a user ───
      case 'delete_user': {
        if (!isSuperAdmin) {
          return new Response(JSON.stringify({ error: 'Yetkiniz yok' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { target_user_id: deleteUserId } = params
        if (!deleteUserId) {
          return new Response(JSON.stringify({ error: 'target_user_id gerekli' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Prevent self-deletion
        if (deleteUserId === user.id) {
          return new Response(JSON.stringify({ error: 'Kendinizi silemezsiniz' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Clean up related data first
        await supabaseAdmin.from('user_roles').delete().eq('user_id', deleteUserId)
        await supabaseAdmin.from('salon_members').delete().eq('user_id', deleteUserId)
        await supabaseAdmin.from('profiles').delete().eq('user_id', deleteUserId)

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(deleteUserId)
        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ success: true, message: 'Kullanıcı silindi' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ─── Salon admin lists staff with user accounts in their salon ───
      case 'list_salon_staff_users': {
        const { salon_id } = params
        if (!salon_id) {
          return new Response(JSON.stringify({ error: 'salon_id gerekli' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!isSuperAdmin && !isSalonAdmin(salon_id)) {
          return new Response(JSON.stringify({ error: 'Yetkiniz yok' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get staff with user accounts
        const { data: staffMembers } = await supabaseAdmin
          .from('salon_members')
          .select('user_id, role, branch_id')
          .eq('salon_id', salon_id)

        if (!staffMembers || staffMembers.length === 0) {
          return new Response(JSON.stringify({ staff_users: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const userIds = staffMembers.map(m => m.user_id)
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', userIds)

        const staffUsers = staffMembers.map(m => {
          const profile = profiles?.find(p => p.user_id === m.user_id)
          return {
            user_id: m.user_id,
            full_name: profile?.full_name || null,
            phone: profile?.phone || null,
            role: m.role,
            branch_id: m.branch_id,
          }
        })

        return new Response(JSON.stringify({ staff_users: staffUsers }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Geçersiz işlem' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
