import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = claimsData.claims.sub as string

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action, ...params } = await req.json()

    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin') ?? false

    const { data: callerMemberships } = await supabaseAdmin
      .from('salon_members')
      .select('salon_id, role')
      .eq('user_id', user.id)

    const isSalonAdminOf = (salonId: string) =>
      callerMemberships?.some(m => m.salon_id === salonId && m.role === 'salon_admin') ?? false

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // Helper to store password in user_passwords table
    const storePassword = async (userId: string, password: string) => {
      await supabaseAdmin.from('user_passwords').upsert(
        { user_id: userId, password_plain: password, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    }

    switch (action) {
      // ─── Change own password ───
      case 'change_own_password': {
        const { new_password } = params
        if (!new_password || new_password.length < 6) return json({ error: 'Şifre en az 6 karakter olmalıdır' }, 400)

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: new_password })
        if (error) return json({ error: error.message }, 400)
        await storePassword(user.id, new_password)
        return json({ success: true, message: 'Şifre başarıyla değiştirildi' })
      }

      // ─── Super admin resets any user's password ───
      case 'admin_reset_password': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)
        const { target_user_id, new_password } = params
        if (!target_user_id || !new_password || new_password.length < 6) return json({ error: 'Geçersiz parametreler' }, 400)

        const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, { password: new_password })
        if (error) return json({ error: error.message }, 400)
        await storePassword(target_user_id, new_password)
        return json({ success: true, message: 'Şifre sıfırlandı' })
      }

      // ─── Salon admin resets staff password ───
      case 'salon_admin_reset_staff_password': {
        const { staff_user_id, salon_id, new_password } = params
        if (!staff_user_id || !salon_id || !new_password || new_password.length < 6) return json({ error: 'Geçersiz parametreler' }, 400)
        if (!isSuperAdmin && !isSalonAdminOf(salon_id)) return json({ error: 'Bu salona yetkiniz yok' }, 403)

        const { data: targetMembership } = await supabaseAdmin
          .from('salon_members').select('id').eq('user_id', staff_user_id).eq('salon_id', salon_id).single()
        if (!targetMembership) return json({ error: 'Bu kullanıcı bu salona ait değil' }, 403)

        const { error } = await supabaseAdmin.auth.admin.updateUserById(staff_user_id, { password: new_password })
        if (error) return json({ error: error.message }, 400)
        await storePassword(staff_user_id, new_password)
        return json({ success: true, message: 'Personel şifresi sıfırlandı' })
      }

      // ─── List all users ───
      case 'list_users': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)

        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
        if (error) return json({ error: error.message }, 400)

        const { data: allRoles } = await supabaseAdmin.from('user_roles').select('*')
        const { data: allMembers } = await supabaseAdmin.from('salon_members').select('*, salons(name)')
        const { data: allProfiles } = await supabaseAdmin.from('profiles').select('*')
        const { data: allPasswords } = await supabaseAdmin.from('user_passwords').select('user_id, password_plain')

        const enrichedUsers = users.map(u => {
          const roles = allRoles?.filter(r => r.user_id === u.id).map(r => r.role) ?? []
          const memberships = allMembers?.filter(m => m.user_id === u.id) ?? []
          const profile = allProfiles?.find(p => p.user_id === u.id)
          const storedPw = allPasswords?.find(p => p.user_id === u.id)
          return {
            id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
            full_name: profile?.full_name || u.user_metadata?.full_name || null,
            phone: profile?.phone || null, roles,
            stored_password: storedPw?.password_plain || null,
            memberships: memberships.map(m => ({
              salon_id: m.salon_id, salon_name: (m as any).salons?.name || '',
              role: m.role, branch_id: m.branch_id,
            })),
          }
        })

        return json({ users: enrichedUsers })
      }

      // ─── Create user ───
      case 'create_user': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)

        const { email, password, full_name, role, salon_id: assignSalonId, salon_role } = params
        if (!email || !password || password.length < 6) return json({ error: 'Email ve şifre (min 6 karakter) gerekli' }, 400)

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: full_name || email },
        })
        if (createError) return json({ error: createError.message }, 400)

        if (role) await supabaseAdmin.from('user_roles').insert({ user_id: newUser.user.id, role })
        if (assignSalonId) {
          await supabaseAdmin.from('salon_members').insert({
            user_id: newUser.user.id, salon_id: assignSalonId, role: salon_role || 'staff',
          })
        }

        await storePassword(newUser.user.id, password)

        return json({ success: true, user_id: newUser.user.id, message: 'Kullanıcı başarıyla oluşturuldu' })
      }

      // ─── Create salon with owner account ───
      case 'create_salon_with_owner': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)

        const { salon_name, slug, phone, address, subscription_plan, owner_email, owner_password, owner_full_name } = params
        if (!salon_name || !slug) return json({ error: 'Salon adı ve slug gerekli' }, 400)
        if (!owner_email || !owner_password || owner_password.length < 6) return json({ error: 'Sahip email ve şifre (min 6 karakter) gerekli' }, 400)

        // Create salon first
        const { data: salon, error: salonError } = await supabaseAdmin.from('salons').insert({
          name: salon_name, slug, phone: phone || null, address: address || null,
          subscription_plan: subscription_plan || 'free', is_active: true,
        }).select().single()

        if (salonError) return json({ error: salonError.message }, 400)

        // Create owner user
        const { data: ownerUser, error: ownerError } = await supabaseAdmin.auth.admin.createUser({
          email: owner_email, password: owner_password, email_confirm: true,
          user_metadata: { full_name: owner_full_name || owner_email },
        })

        if (ownerError) {
          // Rollback salon
          await supabaseAdmin.from('salons').delete().eq('id', salon.id)
          return json({ error: ownerError.message }, 400)
        }

        // Set owner on salon
        await supabaseAdmin.from('salons').update({ owner_user_id: ownerUser.user.id }).eq('id', salon.id)

        // Assign salon_admin role
        await supabaseAdmin.from('user_roles').insert({ user_id: ownerUser.user.id, role: 'salon_admin' })

        // Add as salon member
        await supabaseAdmin.from('salon_members').insert({
          user_id: ownerUser.user.id, salon_id: salon.id, role: 'salon_admin',
        })

        // Store password
        await storePassword(ownerUser.user.id, owner_password)

        return json({
          success: true, salon_id: salon.id, user_id: ownerUser.user.id,
          message: `${salon_name} salonu ve ${owner_email} hesabı oluşturuldu`,
        })
      }

      // ─── Delete user ───
      case 'delete_user': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)
        const { target_user_id: deleteUserId } = params
        if (!deleteUserId) return json({ error: 'target_user_id gerekli' }, 400)
        if (deleteUserId === user.id) return json({ error: 'Kendinizi silemezsiniz' }, 400)

        await supabaseAdmin.from('user_roles').delete().eq('user_id', deleteUserId)
        await supabaseAdmin.from('salon_members').delete().eq('user_id', deleteUserId)
        await supabaseAdmin.from('profiles').delete().eq('user_id', deleteUserId)
        await supabaseAdmin.from('user_passwords').delete().eq('user_id', deleteUserId)

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(deleteUserId)
        if (deleteError) return json({ error: deleteError.message }, 400)
        return json({ success: true, message: 'Kullanıcı silindi' })
      }

      // ─── Update user email ───
      case 'update_user_email': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)
        const { target_user_id, new_email } = params
        if (!target_user_id || !new_email) return json({ error: 'Geçersiz parametreler' }, 400)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) return json({ error: 'Geçersiz e-posta' }, 400)

        const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, { email: new_email })
        if (error) return json({ error: error.message }, 400)
        return json({ success: true, message: 'E-posta güncellendi' })
      }

      // ─── Assign salon membership & role ───
      case 'assign_membership': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)
        const { target_user_id: assignUserId, salon_id: assignSalonId2, salon_role: assignRole, global_role } = params
        if (!assignUserId) return json({ error: 'target_user_id gerekli' }, 400)

        // Assign global role if provided
        if (global_role) {
          // Remove existing roles first, then insert new one
          await supabaseAdmin.from('user_roles').delete().eq('user_id', assignUserId)
          await supabaseAdmin.from('user_roles').insert({ user_id: assignUserId, role: global_role })
        }

        // Assign salon membership if provided
        if (assignSalonId2 && assignRole) {
          // Check if membership already exists
          const { data: existing } = await supabaseAdmin
            .from('salon_members')
            .select('id')
            .eq('user_id', assignUserId)
            .eq('salon_id', assignSalonId2)
            .maybeSingle()

          if (existing) {
            // Update existing membership role
            await supabaseAdmin.from('salon_members')
              .update({ role: assignRole })
              .eq('id', existing.id)
          } else {
            await supabaseAdmin.from('salon_members')
              .insert({ user_id: assignUserId, salon_id: assignSalonId2, role: assignRole })
          }
        }

        return json({ success: true, message: 'Rol ve üyelik atandı' })
      }

      // ─── Remove salon membership ───
      case 'remove_membership': {
        if (!isSuperAdmin) return json({ error: 'Yetkiniz yok' }, 403)
        const { target_user_id: rmUserId, salon_id: rmSalonId } = params
        if (!rmUserId || !rmSalonId) return json({ error: 'target_user_id ve salon_id gerekli' }, 400)

        await supabaseAdmin.from('salon_members')
          .delete()
          .eq('user_id', rmUserId)
          .eq('salon_id', rmSalonId)

        return json({ success: true, message: 'Salon üyeliği kaldırıldı' })
      }

      // ─── List salon staff users ───
      case 'list_salon_staff_users': {
        const { salon_id } = params
        if (!salon_id) return json({ error: 'salon_id gerekli' }, 400)
        if (!isSuperAdmin && !isSalonAdminOf(salon_id)) return json({ error: 'Yetkiniz yok' }, 403)

        const { data: staffMembers } = await supabaseAdmin
          .from('salon_members').select('user_id, role, branch_id').eq('salon_id', salon_id)

        if (!staffMembers || staffMembers.length === 0) return json({ staff_users: [] })

        const userIds = staffMembers.map(m => m.user_id)
        const { data: profiles } = await supabaseAdmin
          .from('profiles').select('user_id, full_name, phone').in('user_id', userIds)

        const staffUsers = staffMembers.map(m => {
          const profile = profiles?.find(p => p.user_id === m.user_id)
          return {
            user_id: m.user_id, full_name: profile?.full_name || null,
            phone: profile?.phone || null, role: m.role, branch_id: m.branch_id,
          }
        })

        return json({ staff_users: staffUsers })
      }

      default:
        return json({ error: 'Geçersiz işlem' }, 400)
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})