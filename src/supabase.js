import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jtutshxidmmygjuevtft.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dXRzaHhpZG1teWdqdWV2dGZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzI1MTksImV4cCI6MjA5MTQwODUxOX0.rfdtjXw4lVm4XbYlsdbexEz-4aSB9DnGf7i9DfqxsGA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
