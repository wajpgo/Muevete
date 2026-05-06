import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testChannel() {
  const channel = supabase.channel('trip_requests');
  channel.subscribe(async (status) => {
    console.log("Channel status:", status);
    if (status === 'SUBSCRIBED') {
      const resp = await channel.send({
        type: 'broadcast',
        event: 'test',
        payload: { message: "hello" }
      });
      console.log("Send channel resp:", resp);
      setTimeout(() => process.exit(0), 1000);
    }
  });
}

testChannel();
