# Shopify Collab KOL Tracker Chrome Extension

This Chrome extension simplifies KOL (Key Opinion Leader) tracking on Shopify Collab by storing contact data in Supabase. Easily track influencers you've contacted, overcoming Shopify's 'favorites' limitations.

## Features
- **Easy Tracking**: Real-time UI shows which KOLs have been contacted.
- **Supabase Integration**: Centralized, reliable storage for KOL data.
- **Flexible Data Handling**: Start fresh, adding new KOLs with a single click.

## Prerequisites
- [Supabase Account](https://supabase.com/): For database setup.
- Chrome Browser: For extension installation.

---



## Quick Setup Guide

### Step 1: Set Up Supabase
1. **Create a Supabase Account**: Sign up at [Supabase](https://supabase.com/).
2. **Create a New Project**: Configure your project as needed.
3. **Go to the SQL Tab**: In Supabase, navigate to the SQL tab and set up a table to store Instagram user data.

   Copy and paste the following SQL code into Supabase’s SQL editor and execute it:

   ```sql
   create table public.instagram_users (
     id bigserial not null,
     user_id text not null,
     created_at timestamp with time zone null default now(),
     updated_at timestamp with time zone null default now(),
     constraint instagram_users_pkey primary key (id),
     constraint instagram_users_user_id_key unique (user_id)
   ) tablespace pg_default;

   create index if not exists idx_instagram_users_user_id on public.instagram_users using btree (user_id) tablespace pg_default;


### Step 2: Configure `supabase-config.js`
1. In your extension’s code, locate `supabase-config.js`
2. Add your Supabase credentials:

```javascript
// supabase-config.js
const supabaseUrl = 'your-supabase-url';
const supabaseKey = 'your-supabase-key';
```
Replace `your-supabase-url` and `your-supabase-key` with your actual Supabase project details from the API settings.

### Step 3: Load the Extension in Chrome
1. Open `chrome://extensions/` in Chrome.
2. Enable Developer Mode (toggle in the top right).
3. Click Load unpacked and select your extension’s folder.

### Step 4: Using the Extension
1. **Adding New KOLs**: Each KOL listed in Shopify Collab will have an `Add` button next to their name. Click it to save their `user_id` to Supabase.
2. **Automatic UI Updates**: The extension instantly updates the UI, marking contacts you've saved. Only unsaved KOLs display the `Add` button.
3. **No Duplicates**: The extension prevents duplicate entries in Supabase, ensuring each KOL is only saved once.


------------

## How It Works

This extension connects to Supabase to store KOL data as you add it. Each KOL is saved with a unique `user_id`, and you can track them directly through the extension’s UI. By starting fresh, you add KOLs one-by-one, simplifying management.

#### Contributing
Contributions are welcome! Please fork the repository and submit a pull request with your changes.
