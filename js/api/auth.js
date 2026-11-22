'use strict';
(function (w) {
  const validEmail = email => /^\S+@\S+\.\S+$/.test(String(email || '').trim());
  const client = () => {
    if (!w.Bookivo.supabase) throw new Error('BOOKIVO could not connect to Supabase. Please refresh and try again.');
    return w.Bookivo.supabase;
  };
  const normalizedEmail = email => String(email || '').trim().toLowerCase();
  const profile = user => {
    if (!user) return null;
    const metadata = user.user_metadata || {};
    return {
      id:user.id,
      name:metadata.username || metadata.full_name || metadata.name || localStorage.getItem('bv_name_'+user.id) || 'bookivouser',
      email:user.email || '',
      createdAt:user.created_at || null,
      avatarUrl:metadata.avatar_url || null
    };
  };
  w.Bookivo.Api.auth = {
    async sendOtp(email, options = {}) {
      const normalized = normalizedEmail(email);
      if (!validEmail(normalized)) throw new Error('Enter a valid email address.');
      const signInOptions = { shouldCreateUser:options.shouldCreateUser !== false };
      if (options.username) signInOptions.data = { username:String(options.username).trim() };
      const { error } = await client().auth.signInWithOtp({ email:normalized, options:signInOptions });
      if (error) throw new Error(error.message);
      return { sent:true };
    },
    async verifyOtp(email, code) {
      const normalized = normalizedEmail(email);
      if (!validEmail(normalized) || !/^\d{6}$/.test(String(code || ''))) {
        return { verified:false, message:'Enter a valid email and the 6-digit code.' };
      }
      const { data, error } = await client().auth.verifyOtp({ email:normalized, token:String(code), type:'email' });
      if (error) return { verified:false, message:error.message };
      const user = profile(data && data.user);
      if (user) w.Bookivo.AuthStore.set(user);
      return { verified:!!user, user };
    },
    async signup(name, email, code) {
      const username = String(name || '').trim();
      if (!username) throw new Error('Enter your name.');
      const result = await this.verifyOtp(email, code);
      if (!result.verified) throw new Error(result.message || 'That code did not match. Request a new code and try again.');
      const { data, error } = await client().auth.updateUser({ data:{ username } });
      if (error) throw new Error(error.message);
      const user = profile(data && data.user) || result.user;
      w.Bookivo.AuthStore.set(user);
      return user;
    },
    async login(email, code) {
      const result = await this.verifyOtp(email, code);
      if (!result.verified) throw new Error(result.message || 'That code did not match. Request a new code and try again.');
      return result.user;
    },
    async logout() {
      return w.Bookivo.AuthStore.logout();
    }
  };
})(window);
