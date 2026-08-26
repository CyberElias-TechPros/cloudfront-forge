-- credit_transactions.balance_after: the watch-claim and daily-bonus reward
-- writers record the resulting balance, but the column never existed — the
-- INSERTs failed silently (Database.execute swallows errors), losing ledger
-- rows. Add the column so the ledger is complete.
ALTER TABLE credit_transactions ADD COLUMN balance_after INTEGER;
