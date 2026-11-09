// Projeto Supabase do Casapark. A chave abaixo é a PÚBLICA (anon): ela só abre a porta do login.
// Quem protege os dados são as regras do banco (RLS) e a verificação em duas etapas.
// NUNCA coloque aqui a "service_role key".
window.CASAPARK_CONFIG = {
  supabaseUrl: "https://hokcwlfjjvfykfyuktwq.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhva2N3bGZqanZmeWtmeXVrdHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MDAzNDIsImV4cCI6MjEwOTM3NjM0Mn0.ELcpiq5gg8VoUz64ISQBMPZvbphE9TsHNdDMhXdQpqE",
  versao: "3",
};
