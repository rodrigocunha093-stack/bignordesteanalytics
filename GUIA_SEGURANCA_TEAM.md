# 🔐 GUIA DE SEGURANÇA - PARA O TEAM

## ⚡ REGRAS DE OURO

1. ❌ **NUNCA** compartilhe o token API_TOKEN
2. ❌ **NUNCA** faça login sem HTTPS (certificado válido)
3. ❌ **NUNCA** ignore avisos de cookie/LGPD
4. ✅ **SEMPRE** use a função "Restaurar Backup" se dados sumirem
5. ✅ **SEMPRE** reporte anomalias → Segurança & Backups

---

## 🔑 CREDENCIAIS SEGURAS

### Token API (CONFIDENCIAL)
```
Ry2L6R9xPcLIjCzzCvV2USD3LAoFZJ5HtLAdutwexEimZ_Ro
```
- Compartilhado apenas com sistema
- Revogado imediatamente se comprometido
- Novo token gerado em Vercel > Environment Variables

### Database URL (CONFIDENCIAL)
- Nunca no código (só em .env)
- Acesso apenas via servidor Node.js
- Logs: PostgreSQL guarda quem conecta

---

## 🛡️ OPERAÇÕES DIÁRIAS

### Importação de Dados (SEGURA)
```
1. Selecione Loja (ex: Loja 01)
2. Selecione Período (ex: 2026-01 a 2026-07)
3. Selecione 5 arquivos obrigatórios:
   - resumo_geral_loja.txt
   - campanhas_ofertas.txt
   - produtos_campanha.txt
   - departamentos_campanha.txt
   - cupons_campanha.txt
4. Clique em "Importar"
5. ✅ Backup criado automaticamente
```

### Recuperação de Dados (URGÊNCIA)
```
Se algum dado sumiu:
1. Vá em "Segurança & Backups"
2. Clique em "Atualizar"
3. Selecione versão anterior
4. Clique em "Restaurar"
5. ✅ Dados voltam em < 5 segundos
```

### Auditoria (RASTREAMENTO)
```
Verificar quem fez o quê:
1. Vá em "Segurança & Backups" > "Histórico"
2. Veja data, hora, arquivo, loja
3. Se suspeito: reporte via Slack
```

---

## 🚨 SE ACONTECER UM INCIDENTE

### Dados Deletados Acidentalmente
```
1. NÃO DESESPERE - Está protegido
2. Vá em Segurança & Backups
3. Selecione versão anterior
4. Clique Restaurar
5. Pronto em <5 segundos
6. Reporte ao admin: o que aconteceu
```

### Erro HTTP 500 em Importação
```
1. Aguarde 30 segundos
2. Recarregue página (F5)
3. Tente novamente
Se persistir:
4. Vá em Segurança & Backups
5. Clique Atualizar
6. Verifique se houve erro de permissão
7. Reporte ao admin
```

### Token Comprometido (EMERGÊNCIA)
```
1. Reporte imediatamente ao admin
2. Admin revoga token em Vercel
3. Admin gera novo token
4. Admin redeploy automático
5. Todos fazem re-login
```

---

## 📝 BOAS PRÁTICAS

### ✅ FAÇA
- ✅ Use senha forte no seu usuário Windows
- ✅ Logout do app ao sair do computador
- ✅ Reporte dados duplicados ao admin
- ✅ Teste importação em homolog antes de prod
- ✅ Documente problemas em ticket/Slack

### ❌ NÃO FAÇA
- ❌ Compartilhe token API com colega
- ❌ Escreva token em email/Slack
- ❌ Use acesso de outro colega
- ❌ Ignore avisos de segurança
- ❌ Force-delete dados sem backup

---

## 🔍 VERIFICAÇÕES RÁPIDAS

### App Está Seguro?
```
1. Abra F12 (Developer Tools)
2. Aba "Network"
3. Faça refresh
4. Procure por header "Strict-Transport-Security"
5. Se aparecer: ✅ SEGURO
```

### Certificado Válido?
```
1. Clique no cadeado 🔒 (canto superior)
2. "Conexão segura"
3. Se aparece "Let's Encrypt": ✅ VÁLIDO
4. Se aparece "expirado": ❌ ALERTA
```

### Teste Anti-CSRF
```
Não há formulário de outro site que pode
enviar dados sem sua aprovação.
→ Verfico automática em cada PUT
```

---

## 📞 SUPORTE

| Problema | Contato |
|----------|---------|
| Não consigo importar | Slack #suporte |
| Dados sumiram | Chame admin urgente |
| Token não funciona | Vercel console |
| Backup não existe | Contato com DevOps |
| Dúvida de segurança | Leia SEGURANCA.md |

---

**Versão:** 1.0  
**Data:** 2026-08-04  
**Classificação:** INTERNO
