// Initialize supabase client
const supabaseUrl = 'your-supabase-url';
const supabaseKey = 'your-supabase-key';

// Create Supabase client
const createClient = async () => {
  try {
    const { createClient } = supabase;
    return createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    return null;
  }
};

// Helper function to handle Supabase operations
async function createSupabaseHelper() {
  const client = await createClient();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  return {
    async addUser(userId) {
      try {
        // Try to insert directly - if user exists, it will fail
        const { error: insertError } = await client
          .from('instagram_users')
          .insert([{ user_id: userId }]);
        
        // If there's a duplicate error, that's fine - user already exists
        if (insertError && !insertError.message.includes('duplicate')) {
          throw insertError;
        }

        console.log('Successfully added user to Supabase:', userId);
        return true;
      } catch (e) {
        if (e.message?.includes('duplicate')) {
          console.log('User already exists in Supabase:', userId);
          return true;
        }
        console.error('Error adding user to Supabase:', e);
        return false;
      }
    },

    async removeUser(userId) {
      try {
        const { error } = await client
          .from('instagram_users')
          .delete()
          .eq('user_id', userId);
        
        if (error) throw error;
        console.log('Successfully removed user from Supabase:', userId);
        return true;
      } catch (e) {
        console.error('Error removing user from Supabase:', e);
        return false;
      }
    },

    async getAllUsers() {
      try {
        let allUsers = [];
        let page = 0;
        const pageSize = 1000;
        
        // Get total count first
        const { count } = await client
          .from('instagram_users')
          .select('user_id', { count: 'exact', head: true });
          
        while (true) {
          const { data, error } = await client
            .from('instagram_users')
            .select('user_id')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          if (error) throw error;
          
          if (!data || data.length === 0) break;
          
          allUsers = allUsers.concat(data.map(user => user.user_id));
          
          // Show loading progress
          if (typeof showLoadingProgress === 'function') {
            showLoadingProgress(allUsers.length, count);
          }
          
          // If we got less than pageSize results, we've reached the end
          if (data.length < pageSize) break;
          
          page++;
          console.log(`Loaded ${allUsers.length} users of ${count} total`);
        }
        
        console.log(`Retrieved ${allUsers.length} users from Supabase`);
        return allUsers;
      } catch (e) {
        console.error('Error getting users from Supabase:', e);
        return [];
      }
    }
  };
}

// Initialize and expose the helper
(async () => {
  try {
    window.supabaseHelper = await createSupabaseHelper();
    console.log('Supabase helper initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Supabase helper:', error);
  }
})();