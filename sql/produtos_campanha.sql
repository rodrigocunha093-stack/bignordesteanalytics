SELECT
    v.id_loja AS loja,

    TO_CHAR(
        DATE_TRUNC('month', v.data),
        'YYYY-MM'
    ) AS mes,

    i.id_tipooferta,

    t.descricao AS campanha,

    i.id_produto,

    p.descricaocompleta AS descricao_produto,

    SUM(i.quantidade) AS quantidade,

    SUM(i.valortotal) AS venda,

    SUM(i.valortotal)
      - SUM(i.customediocomimposto * i.quantidade) AS lucro,

    ROUND(
        (
            SUM(i.valortotal)
            - SUM(i.customediocomimposto * i.quantidade)
        )
        /
        NULLIF(SUM(i.valortotal),0)
        * 100
    ,2) AS margem

FROM pdv.vendaitem i

INNER JOIN pdv.venda v
    ON v.id = i.id_venda

INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta

INNER JOIN public.produto p
    ON p.id = i.id_produto

WHERE v.id_loja = 1
  AND v.data >= '2026-01-01'
  AND v.data < '2026-07-01'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE

GROUP BY
    v.id_loja,
    DATE_TRUNC('month', v.data),
    i.id_tipooferta,
    t.descricao,
    i.id_produto,
    p.descricaocompleta

ORDER BY
    mes,
    campanha,
    venda DESC;
