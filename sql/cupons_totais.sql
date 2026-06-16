-- BIGNORDESTE ANALYTICS
-- Arquivo esperado: cupons_campanha.txt
-- Troque :id_loja, :data_inicio e :data_fim.
-- A coluna mes e gerada automaticamente por DATE_TRUNC.

SELECT
    v.id_loja AS loja,
    TO_CHAR(DATE_TRUNC('month', v.data), 'YYYY-MM') AS mes,
    (
        SELECT COUNT(DISTINCT v2.id)
        FROM pdv.venda v2
        WHERE v2.id_loja = :id_loja
          AND v2.data >= DATE_TRUNC('month', v.data)
          AND v2.data < DATE_TRUNC('month', v.data) + INTERVAL '1 month'
          AND v2.cancelado = FALSE
    ) AS cupons_totais,
    t.descricao AS campanha,
    COUNT(DISTINCT v.id) AS cupons_campanha
FROM pdv.venda v
INNER JOIN pdv.vendaitem i ON i.id_venda = v.id
INNER JOIN public.tipooferta t ON t.id = i.id_tipooferta
WHERE v.id_loja = :id_loja
  AND v.data >= ':data_inicio'
  AND v.data < ':data_fim'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE
GROUP BY
    v.id_loja,
    DATE_TRUNC('month', v.data),
    i.id_tipooferta,
    t.descricao
ORDER BY
    mes,
    cupons_campanha DESC;
