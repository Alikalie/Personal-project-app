# Supabase setup

## Email verification admin control

The `manage-email-verification` Edge Function reads and changes the project's
`mailer_autoconfirm` Auth setting through the Supabase Management API. It
requires an authenticated caller whose `platform_admins.level` is
`super_admin`. Keep the function's JWT verification enabled.

Before deploying, create a **scoped, expiring Supabase Personal Access Token**
with `auth:write` permission for this project. Configure it as an Edge Function
secret named `SUPABASE_MANAGEMENT_API_TOKEN` in the Supabase Dashboard. Never
put it in the app, `.env`, shell history, or source control.

```powershell
$projectRef = "your-project-ref"
supabase functions deploy manage-email-verification --project-ref $projectRef
supabase db push --project-ref $projectRef
```

The project URL, service-role key, and authenticated request handling are
provided by the Supabase Edge Function runtime. The Management API token is
required to update the hosted Auth configuration.

Enabling verification affects future email/password signups. Disabling it lets
new signups sign in without confirming email. Supabase Auth continues to
validate email syntax on the backend, and this does not verify that a person
owns or can access an address.

The migration validates non-empty profile and business phone numbers when they
are inserted or changed. It does not rewrite existing data or reject unchanged
legacy values. Valid phone syntax cannot prove that the number is reachable or
belongs to the user.
