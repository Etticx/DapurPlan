from __future__ import annotations

import numpy as np
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.utils.validation import check_is_fitted

FEATURES = [
    "item",
    "day_of_week",
    "sales_yesterday",
    "sales_last_week",
    "average_previous_7_days",
]


class LastWeekBaseline(RegressorMixin, BaseEstimator):
    """A deployable baseline that predicts the previous matching weekday."""

    def fit(self, X, y):
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        self.n_features_in_ = len(self.feature_names_in_)
        return self

    def predict(self, X):
        check_is_fitted(self, "feature_names_in_")
        if "sales_last_week" not in X.columns:
            raise ValueError("Input is missing sales_last_week.")
        return X["sales_last_week"].to_numpy(dtype=float)
