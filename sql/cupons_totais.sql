SELECT
    v.id_loja AS loja,

    TO_CHAR(DATE_TRUNC('month', v.data), 'YYYY-MM') AS mes,

    ct.cupons_totais,

    t.descricao AS campanha,

    COUNT(DISTINCT v.id) AS cupons_campanha

FROM pdv.vendaitem i

INNER JOIN pdv.venda v
    ON v.id = i.id_venda

INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta

INNER JOIN (
    SELECT
        id_loja,
        DATE_TRUNC('month', data) AS mes_ref,
        COUNT(DISTINCT id) AS cupons_totais
    FROM pdv.venda
    WHERE id_loja = 1
      AND data >= '2026-01-01'
      AND data < '2026-07-01'
      AND cancelado = FALSE
    GROUP BY
        id_loja,
        DATE_TRUNC('month', data)
) ct
    ON ct.id_loja = v.id_loja
   AND ct.mes_ref = DATE_TRUNC('month', v.data)

WHERE v.id_loja = 1
  AND v.data >= '2026-01-01'
  AND v.data < '2026-07-01'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE

GROUP BY
    v.id_loja,
    DATE_TRUNC('month', v.data),
    ct.cupons_totais,
    t.descricao

ORDER BY
    mes,
    cupons_campanha DESC;
