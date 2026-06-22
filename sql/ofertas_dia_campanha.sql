SELECT
    v.id_loja AS loja,

    v.data AS data,

    i.id_tipooferta,

    t.descricao AS campanha,

    SUM(i.valortotal) AS venda_oferta,

    SUM(i.customediocomimposto * i.quantidade) AS custo_oferta,

    SUM(i.valortotal)
      - SUM(i.customediocomimposto * i.quantidade) AS lucro_oferta,

    ROUND(
        (
            SUM(i.valortotal)
            - SUM(i.customediocomimposto * i.quantidade)
        )
        / NULLIF(SUM(i.valortotal),0) * 100
    ,2) AS margem_oferta,

    SUM(i.quantidade) AS quantidade_oferta,

    COUNT(DISTINCT v.id) AS cupons_oferta,

    COUNT(DISTINCT i.id_produto) AS produtos_oferta

FROM pdv.venda v

INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id

INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta

WHERE v.id_loja = :id_loja
  AND v.data >= :data_inicio
  AND v.data < :data_fim
  AND v.cancelado = FALSE
  AND i.oferta = TRUE

GROUP BY
    v.id_loja,
    v.data,
    i.id_tipooferta,
    t.descricao

ORDER BY
    v.data,
    venda_oferta DESC;
