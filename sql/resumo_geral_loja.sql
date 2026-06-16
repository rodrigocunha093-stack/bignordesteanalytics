SELECT
    v.id_loja AS loja,

    TO_CHAR(DATE_TRUNC('month', v.data), 'YYYY-MM') AS mes,

    SUM(i.valortotal) AS venda_total,

    SUM(i.customediocomimposto * i.quantidade) AS custo_total,

    SUM(i.valortotal)
      - SUM(i.customediocomimposto * i.quantidade) AS lucro_total,

    ROUND(
        (
            SUM(i.valortotal)
            - SUM(i.customediocomimposto * i.quantidade)
        )
        /
        NULLIF(SUM(i.valortotal),0)
        * 100
    ,2) AS margem_total,

    COUNT(DISTINCT v.id) AS cupons_totais,

    SUM(i.quantidade) AS unidades_totais,

    COUNT(DISTINCT i.id_produto) AS produtos_distintos

FROM pdv.venda v

INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id

WHERE v.id_loja = 1
  AND v.data >= '2026-01-01'
  AND v.data < '2026-07-01'
  AND v.cancelado = FALSE

GROUP BY
    v.id_loja,
    DATE_TRUNC('month', v.data)

ORDER BY
    mes;
