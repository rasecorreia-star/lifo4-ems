"""
Hyperparameter tuning with Optuna.
"""
import structlog

log = structlog.get_logger()


def tune_xgboost(X_train, y_train, X_val, y_val, n_trials: int = 30) -> dict:
    """
    Tune XGBoost hyperparameters using Optuna.
    Returns best params dict.
    """
    try:
        import optuna
        import xgboost as xgb
        from sklearn.metrics import mean_absolute_percentage_error

        optuna.logging.set_verbosity(optuna.logging.WARNING)

        def objective(trial):
            params = {
                "n_estimators": trial.suggest_int("n_estimators", 100, 500),
                "max_depth": trial.suggest_int("max_depth", 3, 8),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
                "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
                "tree_method": "hist",
                "random_state": 42,
            }
            model = xgb.XGBRegressor(**params)
            model.fit(X_train, y_train, verbose=False)
            preds = model.predict(X_val)
            return mean_absolute_percentage_error(y_val, preds)

        study = optuna.create_study(direction="minimize")
        study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
        log.info("hyperparameter_tuning_done", best_mape=study.best_value, best_params=study.best_params)
        return study.best_params

    except Exception as e:
        log.warning("hyperparameter_tuning_failed_using_defaults", error=str(e))
        return {"n_estimators": 300, "max_depth": 6, "learning_rate": 0.05, "tree_method": "hist"}
