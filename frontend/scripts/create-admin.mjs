import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azcijaqvxfqdaghzhmfm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6Y2lqYXF2eGZxZGFnaHpobWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTk4MjEsImV4cCI6MjA5MDM5NTgyMX0.vtqVqmB8BbaMHgaXAPltv7a0vWyUzELMz223fRw99vE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL = 'parthsingla2005@gmail.com';
const PASSWORD = 'parth7234';
const DISPLAY_NAME = 'Parth Singla';
const ROLE = 'admin';

async function createAdmin() {
  console.log(`\n🔧 Creating admin user: ${EMAIL}\n`);

  // Step 1: Sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    options: { data: { display_name: DISPLAY_NAME, role: ROLE } },
  });

  if (signUpError) {
    // If user already exists, try logging in instead
    if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
      console.log('⚠️  User already registered in Supabase Auth. Attempting login...');
      
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD,
      });

      if (loginError) {
        console.error('❌ Login failed:', loginError.message);
        process.exit(1);
      }

      const userId = loginData.user.id;
      console.log(`✅ Logged in. User ID: ${userId}`);

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile) {
        if (existingProfile.role === 'admin') {
          console.log('✅ Profile already exists with admin role. Nothing to do!');
        } else {
          // Update role to admin
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', userId);

          if (updateError) {
            console.error('❌ Failed to update role:', updateError.message);
          } else {
            console.log(`✅ Updated role from "${existingProfile.role}" → "admin"`);
          }
        }
      } else {
        // Create profile
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          email: EMAIL,
          display_name: DISPLAY_NAME,
          role: ROLE,
        });

        if (insertError) {
          console.error('❌ Failed to create profile:', insertError.message);
        } else {
          console.log('✅ Admin profile created successfully!');
        }
      }

      await supabase.auth.signOut();
      return;
    }

    console.error('❌ Sign up failed:', signUpError.message);
    process.exit(1);
  }

  const user = signUpData.user;
  if (!user) {
    console.error('❌ No user returned from sign up');
    process.exit(1);
  }

  console.log(`✅ User created. ID: ${user.id}`);

  // Step 2: Create profile (only if session exists — i.e. email confirm is off)
  if (signUpData.session) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      email: EMAIL,
      display_name: DISPLAY_NAME,
      role: ROLE,
    });

    if (profileError) {
      console.error('❌ Failed to create profile:', profileError.message);
    } else {
      console.log('✅ Admin profile created successfully!');
    }

    await supabase.auth.signOut();
  } else {
    console.log('⚠️  Email confirmation required. Profile will be created on first login.');
    console.log('   Check your email and confirm, then log in via the app.');
  }

  console.log('\n🎉 Done!\n');
}

createAdmin().catch(console.error);
