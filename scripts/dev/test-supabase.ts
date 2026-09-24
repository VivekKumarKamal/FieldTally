import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
  console.log("Fetching policies...");
  
  // To fetch policies, we need to query pg_policies. We can't do that from anon key.
  // Instead, let's just make a REST query to see if we can get anything.
  const { data, error } = await supabase.from('form_versions').select('*').limit(1);
  console.log("Select result:", data, error);
}
test();
