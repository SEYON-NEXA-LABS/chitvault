#!/bin/bash
# SEYON ChitVault — Setup Script
# Run this once after extracting the zip

set -e

echo "🚀 Setting up SEYON ChitVault..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Set up env
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo ""
  echo "✅ Created .env.local — fill in your Supabase credentials:"
  echo "   NEXT_PUBLIC_SUPABASE_URL=..."
  echo "   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=..."
  echo ""
fi

# 3. Git init
if [ ! -d .git ]; then
  git init
  git add .
  git commit -m "feat: initial SEYON ChitVault setup"
  echo "✅ Git repository initialised"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Fill in .env.local with your Supabase credentials"
echo "  2. Run the SQL schema: supabase_schema_saas.sql"
echo "  3. npm run dev"
echo "  4. Register at http://localhost:3000/register"
echo "  5. Set yourself as superadmin in Supabase:"
echo "     update profiles set role = 'superadmin' where id = '<your-user-id>';"
echo ""
echo "Deploy:"
echo "  railway up"
echo "  Add your domain in Railway settings"
