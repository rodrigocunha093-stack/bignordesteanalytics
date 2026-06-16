SELECT
    v.id_loja AS loja,

    TO_CHAR(DATE_TRUNC('month', v.data), 'YYYY-MM') AS mes,

    i.id_tipooferta,

    t.descricao,

    SUM(i.valortotal) AS venda,

    SUM(i.customediocomimposto * i.quantidade) AS custo,

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
    ,2) AS margem,

    SUM(i.quantidade) AS quantidade,

    COUNT(*) AS itens,

    COUNT(DISTINCT i.id_produto) AS produtos_distintos,

    COUNT(DISTINCT v.id) AS cupons,

    ROUND(
        SUM(i.valortotal)
        / NULLIF(COUNT(DISTINCT v.id),0)
    ,2) AS ticket_medio,

    ROUND(
        SUM(i.valortotal)
        / NULLIF(SUM(i.quantidade),0)
    ,2) AS preco_medio

FROM pdv.venda v

INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id

INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta

WHERE v.id_loja = 1
  AND v.data >= '2026-01-01'
  AND v.data < '2026-07-01'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE

GROUP BY
    v.id_loja,
    DATE_TRUNC('month', v.data),
    i.id_tipooferta,
    t.descricao

ORDER BY
    mes,
    venda DESC;
