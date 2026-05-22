import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://azcijaqvxfqdaghzhmfm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6Y2lqYXF2eGZxZGFnaHpobWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTk4MjEsImV4cCI6MjA5MDM5NTgyMX0.vtqVqmB8BbaMHgaXAPltv7a0vWyUzELMz223fRw99vE'
);

const { data, error } = await supabase
  .from('profiles')
  .select('id, email, display_name, role, created_at')
  .eq('role', 'admin');

if (error) {
  console.error('❌ Query failed:', error.message);
} else if (!data || data.length === 0) {
  console.log('⚠️  No users with role "admin" found in the profiles table.');
} else {
  console.log(`✅ Found ${data.length} admin user(s):\n`);
  data.forEach(u => console.log(`  • ${u.email} — "${u.display_name}" (id: ${u.id}, created: ${u.created_at})`));
}
