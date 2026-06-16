-- BIGNORDESTE ANALYTICS
-- Arquivo esperado: produtos_campanha.txt
-- Objetivo: identificar produtos que sustentam ou prejudicam cada campanha.
-- Troque :id_loja, :mes, :data_inicio e :data_fim antes de executar.

SELECT
    v.id_loja AS loja,
    ':mes' AS mes,
    i.id_tipooferta,
    t.descricao AS campanha,
    i.id_produto,
    p.descricaocompleta AS descricao_produto,
    SUM(i.quantidade) AS quantidade,
    SUM(i.valortotal) AS venda,
    SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade) AS lucro,
    ROUND(
        (SUM(i.valortotal) - SUM(i.customediocomimposto * i.quantidade))
        / NULLIF(SUM(i.valortotal),0) * 100
    ,2) AS margem
FROM pdv.venda v
INNER JOIN pdv.vendaitem i
    ON i.id_venda = v.id
INNER JOIN public.tipooferta t
    ON t.id = i.id_tipooferta
INNER JOIN public.produto p
    ON p.id = i.id_produto
WHERE v.id_loja = :id_loja
  AND v.data >= ':data_inicio'
  AND v.data < ':data_fim'
  AND v.cancelado = FALSE
  AND i.oferta = TRUE
GROUP BY
    v.id_loja,
    i.id_tipooferta,
    t.descricao,
    i.id_produto,
    p.descricaocompleta
ORDER BY
    campanha,
    venda DESC;
