-- OCR-nummer: alla avier får ett unikt nummer med giltig kontrollsiffra.
select tests.assert(public.ocr_check_digit('7992739871') = 3, 'Luhn-kontrollsiffra enligt standardexemplet');
select tests.assert(
  (select count(*) = 0 from public.payments where ocr is null),
  'alla avier har OCR-nummer');
select tests.assert(
  (select bool_and(public.ocr_check_digit(left(ocr, length(ocr) - 1)) = right(ocr, 1)::int) from public.payments),
  'alla OCR-nummer har rätt kontrollsiffra');
select tests.assert(
  (select count(*) = count(distinct ocr) from public.payments),
  'OCR-numren är unika');
select 'Banktesterna gick igenom' as result;
